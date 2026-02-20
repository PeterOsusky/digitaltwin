# Digital Twin POC - Architektura a dokumentacia

## Obsah
1. [Prehlad projektu](#1-prehlad-projektu)
2. [Architektura](#2-architektura)
3. [Tok dat — priklad part/enter](#3-tok-dat--priklad-partenter)
4. [Spustenie](#3-spustenie)
5. [Struktura priecinkov](#5-struktura-priecinkov)
6. [Shared package](#6-shared-package)
7. [Broker package](#7-broker-package)
8. [Simulator package](#8-simulator-package)
9. [Frontend package](#9-frontend-package)
10. [MQTT topiky](#10-mqtt-topiky)
11. [WebSocket spravy](#11-websocket-spravy)
12. [Datovy model](#12-datovy-model)
13. [Factory layout a generovanie 200 stanic](#13-factory-layout-a-generovanie-200-stanic)
14. [Senzorovy system](#14-senzorovy-system)
15. [Metrikovy system](#15-metrikovy-system)
16. [Batching — iba metriky na FE](#16-batching--iba-metriky-na-fe)
17. [Stress test — 2000 topicov](#17-stress-test--2000-topicov)

---

## 1. Prehlad projektu

Digital Twin POC simuluje fabriku s **10 vyrobnymi oblastami**, **20 produkucnymi linkami**, **200 stanicami** a **180 senzormi** na dopravnych pasoch. Vsetky data tecia cez MQTT broker a su vizualizovane v realnom case cez React frontend. UI je **read-only** — ziadne klikanie, ziadne detailne panely, iba vizualizacia stavu.

**Techstack:**
- **Runtime:** Node.js + TypeScript
- **MQTT broker:** Aedes (JS, ziadna externa instalacia)
- **Simulator:** Node.js + mqtt.js klient
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand
- **Monorepo:** npm workspaces

---

## 2. Architektura

```
                    ┌──────────────────────┐
                    │     Simulator        │
                    │  (mqtt.js klient)    │
                    │  200 stanic,         │
                    │  30-60 aktivnych     │
                    │  kusov               │
                    └──────────┬───────────┘
                               │ MQTT publish
                               ▼
                    ┌──────────────────────┐
                    │    Aedes Broker      │
                    │    (port 1883)       │
                    └──────────┬───────────┘
                               │ internal subscribe (factory/#)
                               ▼
               ┌─────────────────────────────────┐
               │   mqtt-handler.ts                │
               │   parsuje MQTT topic → WsMessage │
               ├─────────────────────────────────┤
               │   state-manager.ts               │
               │   in-memory stav (parts,         │
               │   stations, sensors, counters)   │
               └──────────┬──────────────────────┘
                          │ WebSocket broadcast (okamzite)
                          ▼
               ┌──────────────────────┐
               │   WebSocket Server   │
               │    (port 3001)       │
               └──────────┬───────────┘
                          │ ws://localhost:3001
                          ▼
               ┌──────────────────────────────────┐
               │   React Frontend (port 5173)     │
               │                                  │
               │   useWebSocket.ts                │
               │     ├─ part_enter → store.set()  │
               │     ├─ part_exit  → store.set()  │
               │     ├─ transit_*  → store.set()  │
               │     ├─ sensor_*   → store.set()  │
               │     └─ metric_update             │
               │          → metricBuffer (batch)   │
               │          → kazdych 500ms flush    │
               │          → store.set() 1×         │
               └──────────────────────────────────┘
```

**Tok dat:**
1. **Simulator** generuje kusy, simuluje spracovanie na staniciach, vyhodnocuje senzory
2. **Simulator** publikuje MQTT spravy do brokera (vr. per-station-type metrik)
3. **Broker** (interny MQTT klient) subscribne `factory/#`, spracuje spravy cez `mqtt-handler.ts`
4. **State Manager** aktualizuje in-memory stav (kusy, stanice, senzory, countery)
5. **Broker** broadcastne WS spravy — **vsetky okamzite**, ziadny batch na serveri
6. **Frontend** prijma WS spravy:
   - `part_enter`, `part_exit`, `transit_*`, `sensor_trigger`, `station_status` → priamo do Zustand store
   - `metric_update` → do FE-side metricBuffer → flush kazdych 500ms → 1× `set()` do Zustand

---

## 3. Tok dat — priklad part/enter

Kompletny priklad: kus `PART-2026-31129` vstupuje na stanicu `aa-load-1-01`.

### Krok 1: Simulator — `SimulatedPart.enterStation()`

**Subor:** `packages/simulator/src/simulated-part.ts`

```typescript
private enterStation(stationIndex: number, skipProcess = false) {
  const stationId = this.lineStations[stationIndex]; // 'aa-load-1-01'

  // Occupancy check — caka ak je stanica obsadena
  if (this.occupiedStations.has(stationId)) {
    setTimeout(() => this.enterStation(stationIndex, skipProcess), 500);
    return;
  }

  // Claim stanicu
  this.occupiedStations.add(stationId);
  this.heldStation = stationId;

  // MQTT publish
  publish(this.client, 'factory/assembly-a/line-aa1/aa-load-1-01/part/enter', {
    partId: 'PART-2026-31129',
    timestamp: '2026-02-19T14:30:00.000Z',
    stationId: 'aa-load-1-01',
    area: 'assembly-a',
    line: 'line-aa1',
  });

  // Spusti processing (progress 0→100%, potom exitStation)
  // ...
}
```

### Krok 2: Broker — Aedes → interny klient → `processMessage()`

**Subor:** `packages/broker/src/server.ts`

```typescript
// Interny MQTT klient subscribnuty na factory/#
client.on('message', (topic, payload) => {
  const wsMsg = processMessage(topic, payload, state);
  if (wsMsg) broadcast(wsMsg); // okamzity WS broadcast
});
```

**Subor:** `packages/broker/src/mqtt-handler.ts`

```typescript
export function processMessage(topic, payload, state): WsMessage | null {
  // topic = 'factory/assembly-a/line-aa1/aa-load-1-01/part/enter'
  const parts = topic.split('/');
  // parts = ['factory', 'assembly-a', 'line-aa1', 'aa-load-1-01', 'part', 'enter']

  const area = parts[1];     // 'assembly-a'
  const line = parts[2];     // 'line-aa1'
  const station = parts[3];  // 'aa-load-1-01'
  const pathKey = parts.slice(4).join('/'); // 'part/enter'

  switch (pathKey) {
    case 'part/enter':
      state.handlePartEnter(partId, station, area, line, timestamp);
      return { type: 'part_enter', data: { partId, timestamp, stationId: station, area, line } };
  }
}
```

### Krok 3: State Manager — aktualizacia in-memory stavu

**Subor:** `packages/broker/src/state-manager.ts`

```typescript
handlePartEnter(partId, stationId, area, line, timestamp): boolean {
  let part = this.parts.get(partId);
  if (!part) {
    // Novy kus — vytvori sa
    part = { partId, createdAt: timestamp, status: 'in_station',
             currentStation: stationId, currentArea: area,
             currentLine: line, progressPct: 0 };
    this.parts.set(partId, part);
  }
  // Vzdy prepise — aj scrapped/completed (novy kus prepise stary)
  part.status = 'in_station';
  part.currentStation = stationId;
  part.progressPct = 0;

  // Stanica sa nastavi na 'running'
  const station = this.stations.get(stationId);
  if (station) { station.status = 'running'; station.currentPartId = partId; }
  return true;
}
```

### Krok 4: WebSocket broadcast → Frontend

**Subor:** `packages/broker/src/server.ts`

```typescript
function broadcast(msg: WsMessage) {
  const json = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === 1) client.send(json);
  }
}
```

WS sprava: `{ type: 'part_enter', data: { partId, timestamp, stationId, area, line } }`

### Krok 5: Frontend — useWebSocket → Zustand store

**Subor:** `packages/frontend/src/hooks/useWebSocket.ts`

```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data) as WsMessage;
  const s = useStore.getState();

  switch (msg.type) {
    case 'part_enter':
      s.handlePartEnter(msg.data);  // PRIAMO do Zustand
      break;
    case 'metric_update':
      pushMetric(msg.data);         // DO BUFFERU (nie Zustand!)
      break;
    // ... dalsie typy
  }
};
```

### Krok 6: Zustand store — `handlePartEnter()`

**Subor:** `packages/frontend/src/store/useStore.ts`

```typescript
handlePartEnter: (data) => {
  set((state) => {
    const parts = new Map(state.parts);
    let part = parts.get(data.partId);
    if (!part) {
      part = { partId: data.partId, createdAt: data.timestamp, status: 'in_station',
               currentStation: data.stationId, progressPct: 0, ... };
    } else {
      part = { ...part, status: 'in_station', currentStation: data.stationId, progressPct: 0 };
    }
    parts.set(data.partId, part);

    // Stanica → running
    const stations = new Map(state.stations);
    const station = stations.get(data.stationId);
    if (station) stations.set(data.stationId, { ...station, status: 'running', currentPartId: data.partId });

    // Odstranit z transitu
    const transitParts = new Map(state.transitParts);
    transitParts.delete(data.partId);

    // Pridat event do live feed
    const events = addEvent(state.events, { type: 'part_enter', message: '...', ... });

    return { parts, stations, events, transitParts };
  });
},
```

### Krok 7: React re-render

Zustand `set()` → React komponenty subscribed na `parts`, `stations` sa automaticky rerendruju:
- `StationNode` zobrazi stanicu ako `running` (zelena) s part chipom nad nou
- `EventDrawer` zobrazi novy event v live feed

### Kompletna schema

```
SIMULATOR                     BROKER                        FRONTEND
═══════════                   ══════                        ════════

SimulatedPart                 Aedes MQTT broker
.enterStation()               (port 1883)
   │                               │
   │  MQTT publish                 │
   │  factory/.../part/enter       │
   ├──────────────────────────────►│
                                   │
                              Interny MQTT klient
                              client.on('message')
                                   │
                              mqtt-handler.ts
                              processMessage()
                                   │                      useWebSocket.ts
                              state-manager.ts            ws.onmessage
                              handlePartEnter()                │
                                   │                           │
                              WebSocket broadcast              │
                              (port 3001, okamzite)            │
                                   ├──────────────────────────►│
                                                               │
                                               part_enter ──► store.handlePartEnter()
                                               part_exit  ──► store.handlePartExit()
                                               transit_*  ──► store.handleTransit*()
                                               sensor_*   ──► store.handleSensorTrigger()
                                                               │   priamo do Zustand
                                                               │
                                               metric_update ──► metricBuffer.pushMetric()
                                                               │   do bufferu (mimo Zustand)
                                                               │
                                                          kazdych 500ms
                                                               │
                                                          flushMetrics() → batch
                                                          store.handleMetricFlush(batch)
                                                               │   1× set() pre cely batch
                                                               ▼
                                                          React re-render
```

---

## 4. Spustenie

```bash
# Instalacia zavislosti
npm install

# Build shared typov
npm run build:shared

# Spustenie vsetkych 3 servicov naraz
npm run dev

# Spustenie so stress testom (2000 MQTT topicov)
npm run dev:stress
```

Servisy:
| Servis | Port | Prikaz |
|--------|------|--------|
| MQTT Broker | 1883 | `npm run dev:broker` |
| WebSocket | 3001 | (sucast brokera) |
| Simulator | - | `npm run dev:simulator` |
| Simulator (stress) | - | `npm run dev:simulator:stress` |
| Frontend (Vite) | 5173 | `npm run dev:frontend` |

Frontend je dostupny na **http://localhost:5173**

---

## 5. Struktura priecinkov

```
digital_twin/
├── package.json                 # root - npm workspaces config
├── docs/
│   └── ARCHITECTURE.md          # tento dokument
├── tasks/
│   ├── todo.md                  # task tracking
│   └── lessons.md               # poucenia z chyb
├── packages/
│   ├── shared/                  # zdielane typy a konfiguracia
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # re-exporty
│   │       ├── types.ts         # vsetky TypeScript interfejsy
│   │       └── factory-config.ts # GENEROVANY layout 200 stanic
│   │
│   ├── broker/                  # MQTT broker + WS server
│   │   ├── package.json
│   │   └── src/
│   │       ├── server.ts        # Aedes broker + WS server + bridge
│   │       ├── mqtt-handler.ts  # parsovanie MQTT topikov, routing
│   │       └── state-manager.ts # in-memory stav (parts, stations, sensors)
│   │
│   ├── simulator/               # generator fabrickych dat
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.ts         # MQTT connect + start
│   │       ├── factory-simulator.ts  # orchestrator + occupancy tracker
│   │       └── simulated-part.ts     # simulacia jedneho kusu
│   │
│   └── frontend/                # React UI (read-only)
│       ├── package.json
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       ├── index.html
│       └── src/
│           ├── main.tsx         # React entry point
│           ├── App.tsx          # root layout
│           ├── index.css        # Tailwind + animacie
│           ├── types.ts         # frontend mirror typov
│           ├── utils/
│           │   └── format.ts    # formatTime, formatDuration, shortPartId
│           ├── store/
│           │   ├── useStore.ts    # Zustand store (cely stav)
│           │   ├── metricBuffer.ts # FE-side metric buffer (mimo Zustand)
│           │   └── perfStats.ts   # perf tracking mimo Zustand
│           ├── hooks/
│           │   ├── useWebSocket.ts  # WS pripojenie + auto-reconnect
│           │   └── usePerfStats.ts  # polling hook pre stress test
│           └── components/
│               ├── Header.tsx          # navbar + stats + STRESS badge
│               ├── EventDrawer.tsx     # collapsible event feed zdola
│               ├── TopicDataViewer.tsx  # fullscreen overlay pre vsetky topicy
│               └── factory-map/
│                   ├── FactoryFloorMap.tsx  # SVG mapa (viewBox 1600x900)
│                   ├── StationNode.tsx      # stanica (44x20 rect)
│                   ├── ConveyorBelt.tsx     # animovany pas
│                   ├── SensorNode.tsx       # diamant na pase
│                   └── TransitPartChip.tsx  # animovany kus po pase
```

---

## 6. Shared package

### `types.ts` — centralne typy

| Interfejs | Popis |
|-----------|-------|
| `Part` | Sledovany kus — ID, status, currentStation, progressPct (ziadna historia) |
| `StationConfig` | Konfiguracia stanice — ID, displayId, pozicia, typ, nextStations, reworkTarget |
| `StationState` | Runtime stav — status, currentPartId, metrics, counters |
| `SensorConfig` | Konfiguracia senzora — typ, pozicia na pase, failProbability |
| `SensorState` | Runtime stav senzora — posledne rozhodnutie |
| `FactoryLayout` | Kompletny layout fabriky (areas, stations, sensors) |
| `WsMessage` | Discriminated union vsetkych WS sprav (9 typov) |
| `StationMetricConfig` | Konfig jednej metriky (label, unit, prahy, baseValue, variance) |
| `StationCounters` | OK/NOK/Rework pocitadla pre stanicu |

Typy stavov:
```
PartStatus:     in_station | in_transit | completed | scrapped
StationStatus:  online | offline | error | idle | running
ExitResult:     ok | nok | rework
SensorType:     data_check | routing | process_decision
SensorDecision: pass | fail | rework | skip_process
StationType:    load | machine | inspection | measure | buffer | manual | pack
```

### `factory-config.ts` — programove generovanie 200 stanic

**Klucovy princip:** Stanice sa negeneruju rucne — subor pouziva programove cykly nad definiciou gridu:

```typescript
// 10 oblasti v 2-stlpcovom × 5-riadkovom gride
const AREA_DEFS: AreaDef[] = [
  { prefix: 'aa', name: 'Assembly A', areaId: 'assembly-a', col: 0, row: 0, lineIds: ['line-aa1', 'line-aa2'] },
  { prefix: 'ab', name: 'Assembly B', areaId: 'assembly-b', col: 1, row: 0, lineIds: ['line-ab1', 'line-ab2'] },
  // ... 10 oblasti spolu
];

// Vzor stanic na kazdej linke (10 stanic)
const LINE_PATTERN: StationType[] = [
  'load', 'machine', 'machine', 'buffer', 'measure',
  'machine', 'machine', 'measure', 'inspection', 'pack',
];

// Generovanie: for areaDef → for lineIdx → for stationIdx
for (const areaDef of AREA_DEFS) {
  for (let lineIdx = 0; lineIdx < 2; lineIdx++) {
    for (let sIdx = 0; sIdx < LINE_PATTERN.length; sIdx++) {
      const stationId = `${areaDef.prefix}-${sType}-${lineNum}-${stationNum}`;
      stations[stationId] = { position: { x: stationX(col, sIdx), y: stationY(row, lineIdx) }, ... };
    }
  }
}
```

Suradnice sa pocitaju z gridu:
- Lavy stlpec: x od 60 do 740, pravy stlpec: x od 860 do 1540
- 5 riadkov: y starty [10, 185, 360, 535, 710], linka 1 offset +50, linka 2 offset +120

Exporty:
- `FACTORY_LAYOUT` — kompletny layout (200 stanic, 180 senzorov)
- `SENSOR_CONFIG` — pole sensor konfigov
- `getLineRoutes()` — 20 liniek s usporiadanymi stanicami
- `STATION_METRIC_CONFIGS` — per-station-type definicie metrik

---

## 7. Broker package

### `server.ts` — hlavny vstupny bod

```typescript
// 1. Aedes MQTT broker na porte 1883
const aedes = new Aedes();
mqttServer.listen(1883);

// 2. State manager (in-memory)
const state = new StateManager();

// 3. Interny MQTT klient — subscribne factory/#
client.subscribe('factory/#');

// 4. WebSocket server na porte 3001
const wss = new WebSocketServer({ port: 3001 });

// 5. Bridge: MQTT → processMessage() → state update → broadcast WS
client.on('message', (topic, payload) => {
  const wsMsg = processMessage(topic, payload, state);
  if (wsMsg) broadcast(wsMsg); // OKAMZITE, ziadny batch
});

// Pri pripojeni klienta posle kompletny init stav
wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'init', data: state.getInitData() }));
});
```

**Dolezite:** Na strane brokera **nie je ziadny batching**. Kazda MQTT sprava sa okamzite transformuje na WsMessage a broadcastne cez WebSocket.

### `mqtt-handler.ts` — parsovanie MQTT topikov

Routuje MQTT topic na spravny handler v StateManageri:

```
factory/{area}/{line}/transit/start|stop     → handleTransitStart/Stop
factory/{area}/{line}/sensor/{id}/trigger    → handleSensorTrigger
factory/{area}/{line}/{station}/part/enter   → handlePartEnter
factory/{area}/{line}/{station}/part/exit    → handlePartExit
factory/{area}/{line}/{station}/part/process → handlePartProcess
factory/{area}/{line}/{station}/status       → handleStationStatus
factory/{area}/{line}/{station}/metrics/{m}  → handleMetric
```

Priklad spracovania metriky:

```typescript
// topic: 'factory/assembly-a/line-aa1/aa-machine-1-02/metrics/vibration'
// pathKey = 'metrics/vibration'
if (path[0] === 'metrics' && path[1]) {
  const metric = path[1];       // 'vibration'
  const value = data.value;     // 2.45
  const unit = data.unit;       // 'mm/s'
  state.handleMetric(station, metric, value);
  return { type: 'metric_update', data: { stationId: station, metric, value, unit } };
}
```

### `state-manager.ts` — in-memory stav

```typescript
export class StateManager {
  parts = new Map<string, Part>();              // vsetky kusy
  stations = new Map<string, StationState>();    // 200 stanic
  sensors = new Map<string, SensorState>();      // 180 senzorov
  stationCounters = new Map<string, StationCounters>(); // OK/NOK/Rework per station
  layout: FactoryLayout = FACTORY_LAYOUT;

  // Inicializacia: vsetky stanice idle, vsetky senzory inactive
  constructor() {
    for (const [id] of Object.entries(this.layout.stations)) {
      this.stations.set(id, { stationId: id, status: 'idle', currentPartId: null, ... });
      this.stationCounters.set(id, { ok: 0, nok: 0, rework: 0 });
    }
  }
}
```

**Ziadna historia** — iba posledny stav. Ziadne ring buffery, ziadna metricHistory.

---

## 8. Simulator package

### `factory-simulator.ts` — orchestrator

```typescript
export class FactorySimulator {
  private activeParts = new Map<string, SimulatedPart>();
  private partCounter = Math.floor(Date.now() / 1000) % 100000; // unikatne ID napriec restartami

  // Zdielany occupancy tracker — 1 kus na stanicu/belt
  readonly occupiedStations = new Set<string>();
  readonly occupiedBelts = new Set<string>();

  start() {
    // Publikuje initial status pre vsetkych 200 stanic
    for (const [id, station] of Object.entries(FACTORY_LAYOUT.stations)) {
      this.client.publish(`factory/${station.area}/${station.line}/${id}/status`, ...);
    }
    this.scheduleNextPart();

    // Metriky kazdych 5s
    setInterval(() => this.publishMetrics(), 5000);
  }

  // Udrzuje 30-60 aktivnych kusov napriec 20 linkami
  private scheduleNextPart() {
    const delay = this.activeParts.size < 30
      ? randomBetween(1000, 3000)    // rychle plnenie
      : randomBetween(4000, 8000);   // udrzovaci rezim
    setTimeout(() => {
      if (this.activeParts.size < 60) this.createPart();
      this.scheduleNextPart();
    }, delay);
  }

  private createPart() {
    this.partCounter++;
    const partId = `PART-${new Date().getFullYear()}-${String(this.partCounter).padStart(5, '0')}`;
    const line = this.lines[Math.floor(Math.random() * this.lines.length)];

    const part = new SimulatedPart(
      partId, line.stations, line.area, line.lineId, this.client,
      this.occupiedStations,  // zdielany Set
      this.occupiedBelts,     // zdielany Set
      (id) => { this.activeParts.delete(id); },
    );
    this.activeParts.set(partId, part);
    part.start();
  }
}
```

### `simulated-part.ts` — simulacia jedneho kusu

**Occupancy enforcement** — kazdy part kontroluje zdielane Sety pred vstupom:

```typescript
export class SimulatedPart {
  // Tracking co tento kus drzi (pre uvolnenie v destroy())
  private heldStation: string | null = null;
  private heldBelt: string | null = null;

  constructor(
    // ... parametre ...
    private readonly occupiedStations: Set<string>,  // zdielany s FactorySimulator
    private readonly occupiedBelts: Set<string>,      // zdielany s FactorySimulator
  ) {}
}
```

Zivotny cyklus kusu:
```
enterStation()
  │  occupiedStations.has(id)? → caka 500ms → retry
  │  occupiedStations.add(id) → claim
  │  MQTT publish part/enter
  │  processing (progress 0→100%, publish part/process kazdych 2s)
  ▼
exitStation()
  │  occupiedStations.delete(id) → release
  │  MQTT publish part/exit (result: ok/nok/rework)
  │  nok → finish() (scrapped)
  │  rework → transitToStation(reworkTarget)
  │  ok + no nextStations → finish() (completed)
  ▼
transitToStation()
  │  occupiedBelts.has(beltKey)? → caka 500ms → retry
  │  occupiedBelts.add(beltKey) → claim
  │  MQTT publish transit/start
  │  evaluateSensorsSequentially()
  │    kazdý senzor: pass/fail/rework/skip_process
  │    fail → occupiedBelts.delete() + transit/stop + finish()
  │    rework → occupiedBelts.delete() + transitToStation(spatna cesta)
  │  vsetky pass → occupiedBelts.delete() → enterStation(next)
  ▼
enterStation(next) ...
```

**destroy()** — uvolni vsetky drzane zdroje:

```typescript
destroy() {
  this.completed = true;
  // Uvolni timer a intervaly
  if (this.progressInterval) clearInterval(this.progressInterval);
  for (const timer of this.pendingTimers) clearTimeout(timer);
  // Uvolni occupancy
  if (this.heldStation) this.occupiedStations.delete(this.heldStation);
  if (this.heldBelt) this.occupiedBelts.delete(this.heldBelt);
}
```

---

## 9. Frontend package

### Layout (`App.tsx`)

```
┌─────────────────────────────────────────────────┐
│ Header (stats + STRESS badge + Topics + Live)   │
├─────────────────────────────────────────────────┤
│                                                  │
│          Factory Floor Map                       │
│          (SVG 1600x900, read-only)               │
│          200 stanic, 180 senzorov                │
│          10 farebnych oblasti                    │
│                                                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ Event Drawer (collapsible, zdola)           │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ [Topic Data Viewer — fullscreen overlay]         │
└─────────────────────────────────────────────────┘
```

**Read-only** — ziadne klikanie na stanice, kusy, senzory. Ziadny detail panel.

### Zustand Store (`useStore.ts`)

| Stav | Typ | Popis |
|------|-----|-------|
| `connected` | `boolean` | WebSocket pripojeny |
| `layout` | `FactoryLayout \| null` | Layout fabriky z init |
| `parts` | `Map<string, Part>` | Vsetky kusy |
| `stations` | `Map<string, StationState>` | Stavy 200 stanic |
| `transitParts` | `Map<string, TransitPart>` | Kusy v transite (animacia) |
| `sensors` | `Map<string, SensorState>` | Stavy 180 senzorov |
| `events` | `LiveEvent[]` | Poslednych 100 eventov |

**Ziadny selectedPartId/selectedStationId** — vsetko bolo odstranene.

Handlery pre WS spravy:
- `handlePartEnter()` — vytvori/aktualizuje Part, nastavi stanicu na running
- `handlePartExit()` — nastavi status (completed/scrapped/in_transit), stanica na idle, inkrementuje counters
- `handlePartProcess()` — aktualizuje progressPct
- `handleTransitStart()` — prida do transitParts Map (pre animaciu)
- `handleTransitStop()` — oznaci ako stopped, po 5s automaticky zmaze z mapy
- `handleSensorTrigger()` — aktualizuje sensor stav, pri fail oznaci kus ako scrapped
- `handleMetricFlush()` — batch update metrik (1× set() pre cely batch)

### FE-side metric buffer (`metricBuffer.ts`)

```typescript
// Pending buffer — flushed do Zustand kazdych 500ms
const pendingBuffer: MetricEntry[] = [];

// Topic mapa — vsetky topicy, nikdy nevycistena (pre TopicDataViewer)
const topicMap = new Map<string, TopicRecord>();

export function pushMetric(entry: MetricEntry) {
  pendingBuffer.push(entry);
  topicMap.set(`${entry.stationId}/${entry.metric}`, { ...entry, receivedAt: Date.now() });
}

export function flushMetrics(): MetricEntry[] {
  return pendingBuffer.splice(0); // vrati a vycisti
}
```

### Flush loop (`useWebSocket.ts`)

```typescript
// Spusti sa pri WS connect, bezi kazdych 500ms
setInterval(() => {
  const batch = flushMetrics();       // vybere vsetky nahromadene metriky
  if (batch.length === 0) return;

  const t0 = performance.now();
  useStore.getState().handleMetricFlush(batch);  // 1× set() pre cely batch
  const dt = performance.now() - t0;

  recordFlush(batch.length, uniqueStations, dt, totalReceived, topicCount);
}, 500);
```

### Komponenty

#### `Header.tsx`
- Nazov + Compact stats: Active | Done | Scrap | Busy stanice | Avg cycle | Rework% | Throughput/min
- **STRESS badge** (fialovy, zobrazeny pri > 50 topicoch): topics | msg/s | update cas | total
- Topics toggle button
- Connection indicator (Live/Off)

#### `FactoryFloorMap.tsx`
SVG mapa (viewBox `0 0 1600 900`) s 10 oblastnymi pozadiami v 2×5 gride.

Render poradie:
1. Area backgrounds (10 farebnych obdlznikov)
2. Conveyor belts (animovane pasy medzi stanicami)
3. Sensor nodes (diamanty na pasoch)
4. Station nodes (44×20 obdlzniky)
5. Transit part chips (animovane kusy po pasoch)
6. Legend

#### `StationNode.tsx`
- Velkost: **44×20 px** (kompaktne pre 200 stanic)
- Zobrazuje: icon + displayId (7px font, centered)
- Progress bar (2px, zeleny, vnútri stanice)
- Part chip nad stanicou (28×10, modry, read-only)
- Farebne kodovany podla stavu (zelena=running, seda=idle, cervena=error)

#### `ConveyorBelt.tsx`
- Normalne pasy: rovne linky (strokeWidth 6)
- Rework pasy: Bezier krivka (oranzove, ciarkove, obluk -35px nad stanicami)
- Offset od okraja stanice: 22px (polka sirky), 10px (polka vysky)
- Kazdy pas ma skryty `<path>` element s ID `belt-{fromId}__{toId}` pre `getPointAtLength()`

#### `SensorNode.tsx`
- Diamant (4px body), pozicia cez `SVGPathElement.getPointAtLength()`
- Farby: modry (data_check), oranzovy (routing), fialovy (process_decision)
- Flash animacia pri triggeri, decision label (OK/FAIL/REWORK/SKIP) s 2s fade

#### `TransitPartChip.tsx`
- Animovany kruh (r=5) nasledujuci cestu pasu cez `requestAnimationFrame`
- Modry ak sa pohybuje, cerveny ak je zastaveny (sensor fail)
- Zastaveny kus po 5s automaticky zmizne (cleanup v store)

#### `TopicDataViewer.tsx`
- Fullscreen overlay (toggle cez Topics button v Header)
- Zobrazuje VSETKY metriky (topic key | station | metric | value | age)
- Filter/search, farebne kodovany vek (zelena < 2s, seda < 10s, tmava > 10s)
- Refresh kazdych 1s z `metricBuffer.getTopicSnapshot()`

#### `EventDrawer.tsx`
- Defaultne collapsed (len lista "Events (N)")
- Klik otvori (max-height 250px, scroll)
- Zobrazuje poslednych 100 eventov (ikony, farby, cas, part ID)

### CSS Animacie (`index.css`)

| Animacia | Trieda | Popis |
|----------|--------|-------|
| `conveyor-move` | `.conveyor-animate` | Pohyb ciarok na pase |
| `sensor-flash` | `.sensor-flash` | Rozrastajuci sa kruh pri trigger |

---

## 10. MQTT topiky

### Station topics
```
factory/{area}/{line}/{stationId}/part/enter
  payload: { partId, timestamp, stationId, area, line }

factory/{area}/{line}/{stationId}/part/exit
  payload: { partId, timestamp, stationId, area, line, result, cycleTimeMs }

factory/{area}/{line}/{stationId}/part/process
  payload: { partId, timestamp, stationId, progressPct }

factory/{area}/{line}/{stationId}/status
  payload: { stationId, status, timestamp, currentPartId }

factory/{area}/{line}/{stationId}/metrics/{metricName}
  payload: { stationId, value, unit, timestamp }
```

### Transit topics
```
factory/{area}/{line}/transit/start
  payload: { partId, fromStationId, toStationId, transitTimeMs, timestamp }

factory/{area}/{line}/transit/stop
  payload: { partId, fromStationId, toStationId, reason, timestamp }
```

### Sensor topics
```
factory/{area}/{line}/sensor/{sensorId}/trigger
  payload: { sensorId, partId, type, decision, timestamp, fromStationId, toStationId }
```

---

## 11. WebSocket spravy

### Backend → Frontend (`WsMessage`)

| Typ | Data | Kedy |
|-----|------|------|
| `init` | parts[], layout, stations, sensors | Pripojenie klienta |
| `part_enter` | partId, stationId, area, line, timestamp | Kus vstupi na stanicu |
| `part_exit` | partId, stationId, result, cycleTimeMs | Kus opusti stanicu |
| `part_process` | partId, stationId, progressPct | Progress spracovania |
| `station_status` | stationId, status, currentPartId | Zmena stavu stanice |
| `metric_update` | stationId, metric, value, unit | Nova metrika (batching na FE) |
| `transit_start` | partId, from, to, transitTimeMs | Kus zacal transit |
| `transit_stop` | partId, from, to, reason | Kus zastaveny na pase |
| `sensor_trigger` | sensorId, partId, type, decision | Senzor evaluovany |

**Dolezite:** Na strane brokera **nie je ziadny batch** — vsetky spravy su posielane okamzite. Batching metrik prebieha **iba na FE strane** v `metricBuffer.ts`.

---

## 12. Datovy model

### Zivotny cyklus kusu (Part)

```
CREATED → IN_STATION → IN_TRANSIT → IN_STATION → ... → COMPLETED
                                  ↓                       alebo
                            sensor fail              → SCRAPPED (NOK/fail)
                                  ↓
                              SCRAPPED
```

**Ziadna historia** — Part ma iba `progressPct` a `currentStation`. Ziadne `history[]`, ziadne `sensorEvents`.

### Occupancy constraint

Simulator enforcuje **1 kus na stanicu / 1 kus na belt segment**:
- `occupiedStations: Set<string>` — zdielany medzi vsetkymi SimulatedPart instanciami
- `occupiedBelts: Set<string>` — kluc = `fromStationId__toStationId`
- Ak je obsadene, kus caka (polling 500ms)

---

## 13. Factory layout a generovanie 200 stanic

### Grid layout (2 stlpce × 5 riadkov)

| Riadok | Lavy stlpec | Pravy stlpec |
|--------|-------------|--------------|
| 0 | Assembly A (aa) | Assembly B (ab) |
| 1 | Welding A (wa) | Welding B (wb) |
| 2 | Machining A (ma) | Machining B (mb) |
| 3 | Painting A (pa) | Painting B (pb) |
| 4 | Packaging A (ka) | Packaging B (kb) |

Kazda oblast ma **2 linky × 10 stanic = 20 stanic**. Spolu **10 × 20 = 200 stanic**.

### Vzor linky (10 stanic)

```
load → machine → machine → buffer → measure → machine → machine → measure → inspection → pack
```

Measure stanice maju `reworkTarget` smerujuci na predchadzajucu machine stanicu.

### Station ID schema

Format: `{areaPrefix}-{type}-{lineNum}-{stationNum}`

Priklady: `aa-load-1-01`, `wb-machine-2-06`, `pa-measure-1-05`

DisplayId: Sekvencne od 1001 do 1200.

### SVG pozicie (viewBox 1600×900)

Stanice su rozlozene v gride:
- Lavy stlpec: x od 60 do 740 (10 stanic, spacing ~75px)
- Pravy stlpec: x od 860 do 1540
- Riadky: y starty [10, 185, 360, 535, 710]
- Linka 1: y offset +50, Linka 2: y offset +120

---

## 14. Senzorovy system

### Typy senzorov

| Typ | Farba | Rozhodnutie pri fail | Popis |
|-----|-------|---------------------|-------|
| **data_check** | Modra | `fail` → kus stoji, scrapped | Kontrola dat / kvality materialu |
| **routing** | Oranzova | `rework` → kus sa vracia | Rozhodnutie o rework ceste |
| **process_decision** | Fialova | `skip_process` → skip dalsej stanice | Rozhodnutie ci procesovat |

### Generovanie senzorov

**180 senzorov** — 1 senzor na belt segment (9 segmentov per linka × 20 liniek).

Typy sa cykluju: `data_check → routing → process_decision → data_check → ...`

Fail pravdepodobnosti: data_check=3%, routing=6%, process_decision=10%

DisplayId format: `S-{fromStationDisplayId}-A`

---

## 15. Metrikovy system

### Station-type metriky

Kazdy typ stanice publikuje specificke metriky kazdych 5 sekund:

| Typ stanice | Metriky |
|-------------|---------|
| **load** | weight (kg) |
| **machine** | vibration (mm/s), power (kW), temperature (°C) |
| **measure** | dimension (mm), accuracy (%) |
| **inspection** | score (pts), defects (pcs) |
| **manual** | temperature (°C) |
| **pack** | weight (kg) |
| **buffer** | ziadne |

Hodnoty sa generuju cez **random walk s mean-reversion** okolo `baseValue ± variance`.

---

## 16. Batching — iba metriky na FE

**Na strane brokera nie je ziadny batch.** Kazda MQTT sprava sa okamzite transformuje na WsMessage a broadcastne.

**Batch existuje IBA na FE strane** pre `metric_update` spravy:

```
Simulator → MQTT publish → Broker → WS broadcast (okamzite, kazda sprava)
                                          ↓
                                    Frontend prijme
                                          ↓
                           ┌──────────────┴──────────────┐
                           │                              │
                    part_enter, exit, ...           metric_update
                    transit, sensor                       │
                           │                     pushMetric() → buffer
                    PRIAMO do Zustand                     │
                    (kazda sprava = 1× set())     kazdych 500ms
                                                         │
                                                  flushMetrics() → batch
                                                  handleMetricFlush(batch)
                                                  1× set() pre cely batch
```

Preco batch iba pre metriky:
- 200 stanic × ~2 metriky = ~400 metric_update za 5 sekund
- Bez batchu: 400 × Zustand `set()` = React laguje
- S batchom: ~10 flush (500ms interval × 5s) × 1 `set()` = plynule

---

## 17. Stress test — 2000 topicov

### Aktivacia

```bash
npm run dev:stress
```

### Co generuje stress test

| Zdroj | Topicov | Msg/s |
|-------|---------|-------|
| Realne stanice (200) | ~460 metric topicov | ~92/s |
| Virtualne stanice (125 × 15 metrik) | 1875 metric topicov | ~375/s |
| Part lifecycle, sensors, transit | rozne | ~20-30/s |
| **Spolu** | **~2335** | **~490/s** |

### STRESS badge

Zobrazuje sa v Header ak pocet topicov > 50:
- Pocet topicov
- msg/s (rolling 10s okno)
- Store update cas (zelena < 16ms, zlta < 50ms, cervena > 50ms)
- Celkovy pocet prijatych metrik

### Performance tracking

`perfStats.ts` — mimo Zustand (ziadne zbytocne re-rendery):
- `lastFlushSize` — pocet metrik v poslednom batchi
- `lastUpdateMs` — cas store updatu v ms
- `metricsPerSecond` — msg/s
- `uniqueTopics` — pocet unikatnych topicov

Citane cez `usePerfStats()` hook (polling 1s).

---

## Zavislosti

### Broker
- `aedes` — MQTT broker v Node.js
- `mqtt` — MQTT klient (interny subscriber)
- `ws` — WebSocket server
- `tsx` — TypeScript executor (dev)

### Simulator
- `mqtt` — MQTT klient
- `cross-env` — cross-platform env premenne
- `tsx` — TypeScript executor (dev)

### Frontend
- `react`, `react-dom` — UI framework
- `zustand` — state management
- `vite` — build tool + dev server
- `tailwindcss` — utility CSS
- `@vitejs/plugin-react` — React HMR
