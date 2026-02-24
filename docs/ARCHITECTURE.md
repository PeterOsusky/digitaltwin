# Digital Twin POC - Architecture & Documentation

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Running the Project](#3-running-the-project)
4. [Configuring Stations & Topics](#4-configuring-stations--topics)
5. [Data Processing (result ok/nok)](#5-data-processing-result-oknok)
6. [IsAlive Mechanism](#6-isalive-mechanism)
7. [Folder Structure](#7-folder-structure)
8. [Shared Package](#8-shared-package)
9. [Broker Package](#9-broker-package)
10. [Simulator Package](#10-simulator-package)
11. [Frontend Package](#11-frontend-package)
12. [MQTT Topics](#12-mqtt-topics)
13. [WebSocket Messages](#13-websocket-messages)

---

## 1. Project Overview

Digital Twin POC visualizes factory state in real time. It currently has **9 manually configured stations** across **3 areas** (Vyroba, Montaz, Kontrola), connected by conveyor belts. Each station listens on its own MQTT topic and stores the last received value. The UI is **read-only**.

**Tech stack:**
- **Runtime:** Node.js + TypeScript
- **MQTT broker:** Aedes (JS, no external installation needed)
- **Simulator:** Node.js + mqtt.js client (optional — not used in production)
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand
- **Monorepo:** npm workspaces

---

## 2. Architecture

```
                ┌────────────────────────┐
                │  Real devices           │
                │  (or Simulator)         │
                │  MQTT publish to        │
                │  data + isAlive topics  │
                └───────────┬────────────┘
                            │ MQTT publish
                            ▼
                ┌────────────────────────┐
                │    Aedes Broker        │
                │    (port 1883)         │
                └───────────┬────────────┘
                            │ subscribe to specific topics
                            ▼
            ┌──────────────────────────────┐
            │   mqtt-handler.ts            │
            │   maps topic → stationId     │
            ├──────────────────────────────┤
            │   state-manager.ts           │
            │   in-memory state            │
            │   (stations + lastValue)     │
            │   isAlive timeout check      │
            └───────────┬──────────────────┘
                        │ WebSocket broadcast
                        ▼
            ┌──────────────────────────┐
            │   WebSocket Server       │
            │    (port 3001)           │
            └───────────┬──────────────┘
                        │ ws://localhost:3001
                        ▼
            ┌───────────────────────────────┐
            │   React Frontend (port 5173)  │
            │                               │
            │   useWebSocket.ts             │
            │     ├─ init           → store │
            │     ├─ station_update → store │
            │     └─ station_status → store │
            └───────────────────────────────┘
```

**Data flow:**
1. Device (or simulator) publishes JSON data to a station's MQTT data topic
2. Device periodically publishes isAlive heartbeat to the station's isAlive topic
3. Broker subscribes to all topics from config, processes them via `mqtt-handler.ts`
4. State manager updates in-memory state (last value, alive timestamp)
5. Broker broadcasts WS message to frontend — everything immediate, no batching
6. Frontend updates Zustand store and re-renders the SVG map

---

## 3. Running the Project

### Everything (broker + simulator + frontend)

```bash
npm install
npm run build:shared
npm run dev
```

### Without simulator (production use)

If you have real devices publishing to MQTT:

```bash
# Terminal 1: Broker (MQTT + WebSocket)
npm run dev:broker

# Terminal 2: Frontend
npm run dev:frontend
```

The simulator is not needed — the broker listens on MQTT topics defined in config. Any MQTT client (real device, PLC, gateway) can publish to these topics.

### Ports

| Service | Port | Command |
|---------|------|---------|
| MQTT Broker | 1883 | `npm run dev:broker` |
| WebSocket | 3001 | (part of broker) |
| Simulator | - | `npm run dev:simulator` |
| Frontend (Vite) | 5173 | `npm run dev:frontend` |

Frontend: **http://localhost:5173**

---

## 4. Configuring Stations & Topics

All configuration is in a single file: **`packages/shared/src/factory-config.ts`**

### Adding a new station

Add an object to the `STATIONS[]` array:

```typescript
const STATIONS: StationConfig[] = [
  {
    stationId: 'station-1',       // unique ID
    name: 'Vyroba 1',             // display name on the map
    area: 'vyroba',               // area ID (must exist in AREAS[])
    mqttTopic: 'factory/station1/data',      // topic for data messages
    isAliveTopic: 'factory/station1/isalive', // topic for heartbeat
    position: { x: 160, y: 120 },  // SVG position on the map
    nextStations: ['station-2'],    // belt connections ([] if last in line)
  },
  // ... more stations
];
```

### Adding a new area

Add an object to the `AREAS[]` array:

```typescript
const AREAS: AreaConfig[] = [
  {
    areaId: 'vyroba',                                    // unique ID
    name: 'Vyroba',                                      // display name
    color: '#1e3a5f',                                    // background color
    bounds: { x: 30, y: 30, w: 800, h: 170 },           // position + size on the map
    stationIds: ['station-1', 'station-2', 'station-3'], // stations in this area
  },
];
```

### Current layout

```
VYROBA     [station-1] ──belt──> [station-2] ──belt──> [station-3]
MONTAZ     [station-4] ──belt──> [station-5] ──belt──> [station-6]
KONTROLA   [station-7] ──belt──> [station-8] ──belt──> [station-9]
```

SVG viewBox: `860 x 640`. When adding stations/areas you may need to adjust the viewBox in `FactoryFloorMap.tsx`.

### MQTT topic format

Topics are fully manual — you can use any format. Each station has 2 topics:
- **Data topic** (`mqttTopic`) — for data messages (ok/nok, measurements, ...)
- **IsAlive topic** (`isAliveTopic`) — for heartbeat messages

Example: `factory/station1/data` and `factory/station1/isalive`

The broker subscribes to these exact topics (not a wildcard like `factory/#`), so make sure topics in config match what your devices publish.

---

## 5. Data Processing (result ok/nok)

### How the broker processes data

**File:** `packages/broker/src/mqtt-handler.ts`

When a message arrives on a station's data topic:
1. Broker maps topic to `stationId` (via `getDataTopicMap()`)
2. Parses payload as JSON
3. Stores the **entire JSON object** as `lastValue` in `StationState`
4. Sends it to frontend via WebSocket as `station_update`

```typescript
// mqtt-handler.ts — key part
const data = JSON.parse(payload.toString()); // entire JSON object
state.handleStationUpdate(dataStationId, data, timestamp);
return {
  type: 'station_update',
  data: { stationId: dataStationId, value: data, timestamp },
};
```

The broker **does not interpret** the JSON content — it just stores and forwards it. The entire JSON is available as `station.lastValue`.

### How the frontend displays results

**File:** `packages/frontend/src/components/factory-map/StationNode.tsx`

The frontend currently looks for these fields in `lastValue`:
- `result` — if `'ok'` shows green indicator, if `'nok'` shows red
- `partId` — displayed next to result (last 7 characters)

```typescript
// StationNode.tsx — key part
const resultText = lastValue ? String(lastValue.result ?? '') : '';
const partId = lastValue ? String(lastValue.partId ?? '') : '';
const isOk = resultText === 'ok';
const isNok = resultText === 'nok';
```

### Custom JSON format (production use)

In production the JSON will be more complex. Example:

```json
{
  "partId": "VIN-2026-ABC123",
  "result": "ok",
  "measurements": {
    "torque": 45.2,
    "temperature": 82.1,
    "pressure": 3.4
  },
  "operatorId": "OP-001",
  "timestamp": "2026-02-24T10:30:00.000Z"
}
```

**What to change:**

1. **Different result field name** — if you use a different field (e.g. `status` instead of `result`), edit `StationNode.tsx`:
   ```typescript
   // Example: using "status" instead of "result"
   const resultText = lastValue ? String(lastValue.status ?? '') : '';
   ```

2. **Display more data** — to show additional fields from the JSON, edit `StationNode.tsx` — add SVG text elements below the station or extend the indicator.

3. **No broker changes needed** — the broker forwards the entire JSON object unchanged. All display logic is in the frontend.

### Example: real device publishing to MQTT

```bash
# Using an MQTT client (e.g. mosquitto_pub)
mosquitto_pub -h localhost -p 1883 \
  -t "factory/station1/data" \
  -m '{"partId":"VIN-2026-001","result":"ok","timestamp":"2026-02-24T10:30:00Z"}'
```

---

## 6. IsAlive Mechanism

Each station has an isAlive topic to detect whether the device is alive.

### How it works

1. Device periodically publishes to the isAlive topic (e.g. every 30 seconds):
   ```json
   { "timestamp": "2026-02-24T10:30:00.000Z" }
   ```

2. Broker receives the heartbeat and marks the station as **online** (if it was offline, sends `station_status` to frontend)

3. Broker checks all online stations every **30 seconds**. If more than **5 minutes** have passed since the last heartbeat, the station is marked **offline** and a `station_status` message is sent to the frontend.

### Configuring the timeout

**File:** `packages/broker/src/state-manager.ts`

```typescript
const ALIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
```

Change this constant to adjust the timeout.

### Frontend display

- **Online station:** green border, green status dot, "ONLINE" text
- **Offline station:** pulsing red border, red dot, "OFFLINE" text

---

## 7. Folder Structure

```
digital_twin/
├── package.json                 # root — npm workspaces config
├── docs/
│   └── ARCHITECTURE.md          # this document
├── packages/
│   ├── shared/                  # shared types and configuration
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # re-exports
│   │       ├── types.ts         # TypeScript interfaces
│   │       └── factory-config.ts # MANUAL station and area configuration
│   │
│   ├── broker/                  # MQTT broker + WS server
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts        # Aedes broker + WS server + alive check
│   │       ├── mqtt-handler.ts  # MQTT topic → stationId mapping
│   │       └── state-manager.ts # in-memory state (stations + lastValue)
│   │
│   ├── simulator/               # OPTIONAL test data generator
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts         # MQTT connect + start
│   │       └── factory-simulator.ts  # generates OK/NOK + partId per station
│   │
│   └── frontend/                # React UI (read-only)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx         # React entry point
│           ├── App.tsx          # root layout
│           ├── index.css        # Tailwind + animations
│           ├── types.ts         # frontend mirror of types
│           ├── store/
│           │   └── useStore.ts  # Zustand store
│           ├── hooks/
│           │   └── useWebSocket.ts  # WS connection + auto-reconnect
│           └── components/
│               ├── Header.tsx          # navbar + station count + connection status
│               └── factory-map/
│                   ├── FactoryFloorMap.tsx  # SVG map (viewBox 860x640)
│                   ├── StationNode.tsx      # station + ok/nok indicator
│                   └── ConveyorBelt.tsx     # animated conveyor belt
```

---

## 8. Shared Package

### `types.ts` — core types

| Interface | Description |
|-----------|-------------|
| `AreaConfig` | Area — ID, name, color, bounds (SVG position), stationIds |
| `StationConfig` | Station — ID, name, area, mqttTopic, isAliveTopic, position, nextStations |
| `StationState` | Runtime state — status (online/offline), lastValue, lastUpdated, lastAliveAt |
| `FactoryLayout` | Complete layout (areas[] + stations Record) |
| `WsMessage` | Discriminated union of WS messages (3 types: init, station_update, station_status) |

### `factory-config.ts` — manual configuration

- `STATIONS[]` — array of 9 stations (to add a new one = add an object)
- `AREAS[]` — array of 3 areas
- `FACTORY_LAYOUT` — exported layout
- `getMqttTopics()` — all topics (data + isAlive) for subscribing
- `getDataTopicMap()` — map: data topic → stationId
- `getAliveTopicMap()` — map: isAlive topic → stationId

---

## 9. Broker Package

### `server.ts`

1. Aedes MQTT broker on port 1883
2. State manager (in-memory)
3. Internal MQTT client — subscribes to specific topics from `getMqttTopics()`
4. WebSocket server on port 3001
5. Bridge: MQTT message → `processMessage()` → state update → WS broadcast
6. Alive timeout check every 30 seconds

### `mqtt-handler.ts`

Maps MQTT topic to stationId using two maps:
- `aliveTopicMap` — isAlive topics → stationId
- `dataTopicMap` — data topics → stationId

If message arrives on isAlive topic: updates alive timestamp, sends `station_status` if status changed.
If message arrives on data topic: parses JSON, stores as `lastValue`, sends `station_update`.

### `state-manager.ts`

- `handleStationUpdate()` — stores entire JSON as `lastValue`
- `handleAlive()` — updates `lastAliveAt`, returns true if status changed to online
- `checkAliveTimeouts()` — checks all online stations, if > 5 min without alive → offline
- `getInitData()` — complete state for new WS client

---

## 10. Simulator Package

**Optional** — only used for testing without real devices.

### What it does

- For each station from config, every **1.5 seconds** publishes:
  ```json
  {
    "partId": "PART-2026-00042",
    "result": "ok",
    "timestamp": "2026-02-24T10:30:00.000Z"
  }
  ```
  - `result` is `"ok"` (85%) or `"nok"` (15%)
  - `partId` is a sequential number

- Every **30 seconds** publishes isAlive heartbeat to each station's isAlive topic

---

## 11. Frontend Package

### Zustand Store (`useStore.ts`)

| State | Type | Description |
|-------|------|-------------|
| `connected` | `boolean` | WebSocket connected |
| `layout` | `FactoryLayout \| null` | Layout from init message |
| `stations` | `Map<string, StationState>` | State of all 9 stations |

Handlers: `handleInit`, `handleStationUpdate`, `handleStationStatus`

### Components

**Header.tsx** — title, online station count, connection indicator (Live/Off)

**FactoryFloorMap.tsx** — SVG map with area backgrounds, belt connections, stations and legend

**StationNode.tsx** — SVG station (120x50px):
- Indicator above station: green "OK {partId}" or red "NOK {partId}"
- Station body: name + ONLINE/OFFLINE text
- Green/red border based on online status
- Pulsing red overlay when offline

**ConveyorBelt.tsx** — animated conveyor belt between stations (with direction arrow)

### WebSocket (`useWebSocket.ts`)

- Connects to `ws://localhost:3001`
- Auto-reconnect every 3 seconds
- Handles 3 message types: `init`, `station_update`, `station_status`

---

## 12. MQTT Topics

### Data topics (per station)

```
factory/station1/data     → station-1
factory/station2/data     → station-2
...
factory/station9/data     → station-9
```

Payload: any JSON object. Frontend currently looks for `result` and `partId` fields.

### IsAlive topics (per station)

```
factory/station1/isalive  → station-1
factory/station2/isalive  → station-2
...
factory/station9/isalive  → station-9
```

Payload: `{ "timestamp": "..." }` (timestamp is optional, broker uses server time if missing)

---

## 13. WebSocket Messages

### Backend → Frontend (`WsMessage`)

| Type | Data | When |
|------|------|------|
| `init` | layout, stations | Client connects (full state) |
| `station_update` | stationId, value, timestamp | Data message received on MQTT |
| `station_status` | stationId, status | Online/offline status change |

### Dependencies

| Package | Dependencies |
|---------|------------|
| **Broker** | aedes, mqtt, ws, tsx |
| **Simulator** | mqtt, tsx |
| **Frontend** | react, react-dom, zustand, vite, tailwindcss |
