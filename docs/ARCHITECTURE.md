# Digital Twin POC - Architektura a dokumentacia

## Obsah
1. [Prehlad projektu](#1-prehlad-projektu)
2. [Architektura](#2-architektura)
3. [Spustenie](#3-spustenie)
4. [Struktura priecinkov](#4-struktura-priecinkov)
5. [Shared package](#5-shared-package)
6. [Broker package](#6-broker-package)
7. [Simulator package](#7-simulator-package)
8. [Frontend package](#8-frontend-package)
9. [MQTT topiky](#9-mqtt-topiky)
10. [WebSocket spravy](#10-websocket-spravy)
11. [Datovy model](#11-datovy-model)
12. [Factory layout a ID schema](#12-factory-layout-a-id-schema)
13. [Senzorovy system](#13-senzorovy-system)
14. [Metrikovy system (V4)](#14-metrikovy-system-v4)
15. [Stress test — 2000 topicov (V4.1)](#15-stress-test--2000-topicov-v41)

---

## 1. Prehlad projektu

Digital Twin POC simuluje fabriku s 3 vyrobnymi linkami (Assembly, Welding, Painting), 16 stanicami a 22 senzormi na dopravnych pasoch. Vsetky data tecia cez MQTT broker a su vizualizovane v realnom case cez React frontend.

**Techstack:**
- **Runtime:** Node.js + TypeScript
- **MQTT broker:** Aedes (JS, ziadna externy instalacia)
- **Simulator:** Node.js + mqtt.js klient
- **Frontend:** React 18 + Vite + Tailwind CSS + Zustand + Recharts
- **Monorepo:** npm workspaces

---

## 2. Architektura

```
                    ┌──────────────────────┐
                    │     Simulator        │
                    │  (mqtt.js klient)    │
                    └──────────┬───────────┘
                               │ MQTT publish
                               ▼
                    ┌──────────────────────┐
                    │    Aedes Broker      │
                    │    (port 1883)       │
                    └──────────┬───────────┘
                               │ internal subscribe
                               ▼
                    ┌──────────────────────┐
                    │   State Manager      │
                    │  (in-memory state)   │
                    └──────────┬───────────┘
                               │ WebSocket broadcast
                               ▼
                    ┌──────────────────────┐
                    │   WebSocket Server   │
                    │    (port 3001)       │
                    └──────────┬───────────┘
                               │ ws://localhost:3001
                               ▼
                    ┌──────────────────────┐
                    │   React Frontend     │
                    │    (port 5173)       │
                    └──────────────────────┘
```

Tok dat:
1. **Simulator** generuje kusy, simuluje spracovanie na staniciach, vyhodnocuje senzory
2. **Simulator** publikuje MQTT spravy do brokera (vr. per-station-type metrik)
3. **Broker** (interny MQTT klient) subscribne `factory/#`, spracuje spravy cez `mqtt-handler.ts`
4. **State Manager** aktualizuje in-memory stav (kusy, stanice, senzory, metrikova historia, countery)
5. **Broker** broadcastne WS spravy — metriky su **batchovane** (500ms buffer → 1 `metric_batch` sprava)
6. **Frontend** prijma WS spravy, aktualizuje Zustand store (batch handler — 1× `set()` na cely batch), rerenderi SVG mapu

---

## 3. Spustenie

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

> **Stress test mode:** `npm run dev:stress` spusti simulator s env `STRESS_TEST=1` — generuje 1875 virtualnych metric topicov navyse k 35 realnym. V headeri sa zobrazi fialovy STRESS badge s realnymi perf statistikami.

---

## 4. Struktura priecinkov

```
digital_twin/
├── package.json                 # root - npm workspaces config
├── docs/
│   └── ARCHITECTURE.md          # tento dokument
├── packages/
│   ├── shared/                  # zdielane typy a konfiguracia
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── index.ts         # re-exporty
│   │       ├── types.ts         # vsetky TypeScript interfejsy
│   │       └── factory-config.ts # layout stanic, senzory, pozicie
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
│   │       ├── factory-simulator.ts  # orchestrator (vytvara kusy)
│   │       └── simulated-part.ts     # simulacia jedneho kusu
│   │
│   └── frontend/                # React UI
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
│           ├── config/
│           │   └── station-metrics.ts  # STATION_METRIC_CONFIGS (per-type metriky)
│           ├── store/
│           │   ├── useStore.ts  # Zustand store (cely stav aplikacie)
│           │   └── perfStats.ts # perf tracking mimo Zustand (bez re-renderov)
│           ├── hooks/
│           │   ├── useWebSocket.ts  # WS pripojenie + auto-reconnect
│           │   └── usePerfStats.ts  # polling hook pre stress test statistiky
│           └── components/
│               ├── Header.tsx          # navbar + compact stats + search + STRESS badge
│               ├── DetailSlidePanel.tsx # slide-in overlay (part/station detail + charts)
│               ├── EventDrawer.tsx     # collapsible event feed zdola
│               ├── factory-map/
│               │   ├── FactoryFloorMap.tsx  # SVG mapa (viewBox 900x570)
│               │   ├── StationNode.tsx      # stanica (80x36 rect)
│               │   ├── ConveyorBelt.tsx     # animovany pas
│               │   ├── SensorNode.tsx       # diamant na pase
│               │   └── TransitPartChip.tsx  # animovany kus po pase
│               ├── charts/
│               │   ├── MetricSparkline.tsx        # Recharts AreaChart sparkline (120x40)
│               │   ├── OkNokPieChart.tsx           # Recharts donut pie (OK/NOK/Rework)
│               │   └── StationHealthIndicator.tsx  # per-metric riadok (sparkline + hodnota + status)
│               └── part-detail/
│                   ├── PartDetailPanel.tsx  # (nepouziva sa, nahradeny DetailSlidePanel)
│                   └── PartTimeline.tsx     # vertikalny timeline historiae kusu
```

---

## 5. Shared package

**`packages/shared/src/types.ts`** - centralne typy zdielane medzi vsetkymi balickami.

### Hlavne interfejsy:

| Interfejs | Popis |
|-----------|-------|
| `Part` | Sledovany kus - ID, status, historia stanic |
| `PartHistoryEntry` | Zaznam navstevy stanice (enter/exit cas, vysledok, cycle time) |
| `StationConfig` | Konfiguracia stanice - ID, displayId, pozicia, typ, next stations |
| `StationState` | Runtime stav stanice - status, aktualny kus, metriky, metricHistory, counters |
| `SensorConfig` | Konfiguracia senzora - typ, pozicia na pase, pravdepodobnost |
| `SensorState` | Runtime stav senzora - posledne rozhodnutie |
| `FactoryLayout` | Kompletny layout fabriky (areas, stations, sensors) |
| `WsMessage` | Discriminated union vsetkych WS sprav (11 typov vr. metric_batch) |
| `MetricSample` | Hodnota + timestamp pre historiu metriky |
| `StationMetricConfig` | Konfig jednej metriky (label, unit, nominalMin/Max, warningMin/Max, baseValue, variance) |
| `StationCounters` | OK/NOK/Rework pocitadla pre stanicu |

### Typy stavov:

```
PartStatus:    in_station | in_transit | completed | scrapped
StationStatus: online | offline | error | idle | running
ExitResult:    ok | nok | rework
SensorType:    data_check | routing | process_decision
SensorDecision: pass | fail | rework | skip_process
```

**`packages/shared/src/factory-config.ts`** - definicia layoutu fabriky a metrik.

Exporty:
- `FACTORY_LAYOUT` - kompletny layout so stanicami a senzormi
- `SENSOR_CONFIG` - pole senzor konfigov
- `getLineRoutes()` - usporiadane zoznamy stanic pre kazdu linku
- `STATION_METRIC_CONFIGS` - per-station-type definicie metrik (metricId, label, unit, prahy, baseValue)

---

## 6. Broker package

### `server.ts` - Hlavny vstupny bod

1. **Aedes MQTT broker** - port 1883, prijima MQTT spravy od simulatora
2. **Interny MQTT klient** - subscribe na `factory/#`, deleguje spracovanie
3. **WebSocket server** - port 3001, posiela spravy do frontendu
4. **Bridge logika** - MQTT sprava → `processMessage()` → state update → WS broadcast
5. **Metric batching** - metriky sa neposilaju okamzite, ale batchuju sa po 500ms do jednej `metric_batch` WS spravy
6. **Override resume** - simuluje pokracovanie kusu cez zostávajuce stanice po manualnom override

Pri pripojeni noveho WS klienta posle kompletny `init` stav (vr. metricHistory a counters per station).

### `mqtt-handler.ts` - Parsovanie topikov

Parsuje MQTT topic a payload, routuje na spravny handler v StateManageri:

```
factory/{area}/{line}/transit/start|stop     → handleTransitStart/Stop
factory/{area}/{line}/sensor/{id}/trigger    → handleSensorTrigger
factory/{area}/{line}/{station}/part/enter   → handlePartEnter
factory/{area}/{line}/{station}/part/exit    → handlePartExit
factory/{area}/{line}/{station}/part/process → handlePartProcess
factory/{area}/{line}/{station}/status       → handleStationStatus
factory/{area}/{line}/{station}/metrics/{m}  → handleMetric
```

Vracia `WsMessage | null` (null = ignorovat).

### `state-manager.ts` - In-memory stav

Trieda `StateManager`:
- `parts: Map<string, Part>` - vsetky kusy
- `stations: Map<string, StationState>` - stavy stanic
- `sensors: Map<string, SensorState>` - stavy senzorov
- `layout: FactoryLayout` - referencny layout
- `metricHistory: Map<string, Map<string, MetricSample[]>>` - ring buffer (60 vzoriek) per station per metric
- `stationCounters: Map<string, StationCounters>` - OK/NOK/Rework pocitadla per station

Metody zodpovedaju MQTT udalostiam. `getInitData()` vracia kompletny stav pre noveho WS klienta vrátane metricHistory a counters.

**Metric ring buffer:** Kazda stanica uklada poslednych 60 vzoriek pre kazdu metriku. Pri novom `handleMetric()` sa vzorka prida a ak pocet presiahne 60, najstarsie sa odstránia.

---

## 7. Simulator package

### `factory-simulator.ts` - Orchestrator

- Udrzuje 5-10 aktivnych kusov
- Vytvara nove kusy kazdych 3-15 sekund na nahodnej linke
- Generuje station-type-specific metriky kazdych 5 sekund (cez `STATION_METRIC_CONFIGS`)
- Part ID format: `PART-{rok}-{poradove_cislo}` (napr. `PART-2026-00042`)
- **Stress test mode** (`STRESS_TEST=1`): generuje navyse 1875 virtualnych metric topicov (125 virtualnych stanic × 15 metrik)

**Metrikovy simulator:**
- Kazda realna stanica publikuje metriky podla svojho typu (napr. machine → vibration, power, temperature)
- Hodnoty sa generuju cez random walk s mean-reversion okolo `baseValue ± variance`
- Metriky sa publikuju na topic `factory/{area}/{line}/{stationId}/metrics/{metricId}`

### `simulated-part.ts` - Simulacia jedneho kusu

Zivotny cyklus kusu:
```
enterStation() → processing (progress 0-100%) → exitStation()
    ↓                                               ↓
    │                                    result: ok/rework/nok
    │                                               ↓
    │                              transitToStation() s evaluaciou senzorov
    │                                               ↓
    │                              evaluateSensorsSequentially()
    │                                               ↓
    │                              kazdý senzor: pass/fail/rework/skip
    │                                               ↓
    └───────────────────────────── enterStation(nextIdx)
```

**Logika senzorov pocas transitu:**
1. Zobrazi senzory na useku (sorted by `positionOnBelt`)
2. Sekvenvcne evaluuje kazdy senzor v case = `transitTime * positionOnBelt`
3. Vysledky:
   - `pass` → pokracuj k dalsiemu senzoru
   - `fail` (data_check) → kus stoji na pase, `transit/stop`, scrapped
   - `rework` (routing) → kus sa vracia na fromStation
   - `skip_process` (process_decision) → kus prejde dalsiou stanicou bez procesu

**Logika stanic:**
- Measure stanice rozhoduju o vysledku: 85% OK, 12% rework, 3% NOK
- Rework posiela kus spat na `reworkTarget` stanicu
- NOK scrapuje kus (koniec zivotneho cyklu)

---

## 8. Frontend package

### Layout (`App.tsx`)

```
┌─────────────────────────────────────────────────┐
│ Header (stats bar + search + connection)        │
├─────────────────────────────────────────────────┤
│                                    ┌───────────┐│
│                                    │  Detail   ││
│          Factory Floor Map         │  Slide    ││
│          (SVG, fullscreen)         │  Panel    ││
│                                    │  (420px)  ││
│                                    │  overlay  ││
│                                    └───────────┘│
│ ┌─────────────────────────────────────────────┐ │
│ │ Event Drawer (collapsible, zdola)           │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Zustand Store (`useStore.ts`)

Centralny stav aplikacie:

| Stav | Typ | Popis |
|------|-----|-------|
| `connected` | `boolean` | WebSocket pripojeny |
| `layout` | `FactoryLayout \| null` | Layout fabriky z init |
| `parts` | `Map<string, Part>` | Vsetky kusy |
| `stations` | `Map<string, StationState>` | Stavy stanic |
| `transitParts` | `Map<string, TransitPart>` | Kusy v transite (animacia) |
| `sensors` | `Map<string, SensorState>` | Stavy senzorov |
| `events` | `LiveEvent[]` | Poslednych 100 eventov |
| `selectedPartId` | `string \| null` | Vybrany kus |
| `selectedStationId` | `string \| null` | Vybrana stanica |

**Computed metody:**
- `getStationHistory(stationId)` - kusy ktore presli stanicou (max 50)
- `getStats()` - agregovane statistiky (active, completed, scrap, avg cycle, rework%, throughput)

**Batch handler (`handleMetricBatch`):**
- Prijma pole metrik z jedneho WS batchu
- Spracuje vsetky metriky v **jednom** `set()` volani (kriticke pre performance pri 2000 topicoch)
- Virtualné stanice (stress test) sa automaticky preskakuju ak nie su v layoute

### Hooks

**`useWebSocket.ts`**
- Pripaja sa na `ws://localhost:3001`
- Auto-reconnect kazdych 3 sekund
- Routuje 11 typov WsMessage na prislusne store handlery (vr. `metric_batch`)
- Pri `metric_batch` meria cas store updatu a reportuje do `perfStats`

**`usePerfStats.ts`**
- Polling hook (1s interval), cita z externeho `perfStats` objektu
- Nepouziva Zustand — ziadne zbytocne re-rendery
- Pouziva sa v Header pre STRESS badge

### Komponenty

#### `Header.tsx`
Obsahuje:
- Nazov projektu
- **Compact stats bar**: Active | Done | Scrap | Busy stanice | Avg cycle time | Rework % | Throughput/min
- **STRESS badge** (fialovy, zobrazeny len pri stress teste): pocet topicov | pocet stanic | msg/s | update cas (ms, farebne kodovany) | celkovy pocet prijatych metrik
- Search bar (filtruje kusy podla ID, max 8 vysledkov)
- Connection indicator (Live/Off)

#### `FactoryFloorMap.tsx`
SVG mapa (viewBox 0 0 900 570) s 3 oblastnymi pozadiami.

Render poradie:
1. Area backgrounds (modre/cervene/zelene obdlzniky)
2. Conveyor belts (animovane pasy)
3. Route highlights (modre linky ak je vybrany kus)
4. Station highlight rings (glow efekt na navstivenych staniciach)
5. Sensor nodes (diamanty)
6. Station nodes (obdlzniky)
7. Transit part chips (animovane kusy)
8. Legend

Kliknutie na prazdne miesto deselectne vsetko.

#### `StationNode.tsx`
- Velkost: **80x36 px** (kompaktne)
- Zobrazuje: icon typ + displayId (bold) | nazov stanice (male, sede)
- Progress bar ak stanica procesuje
- Part chip nad stanicou (kliknutelny)
- Glow efekt ak je stanica selectnuta
- Klik na stanicu → `selectStation()` + otvori detail panel
- Klik na part chip → `selectPart()` + otvori part detail

#### `ConveyorBelt.tsx`
- Normalne pasy: rovne linky (stroke-width 10, sede)
- Rework pasy: Bezier krivka (oranzove, ciarkove)
- Animacia: CSS `stroke-dashoffset` animacia (0.8s)
- Kazdy pas ma skryty `<path>` element s ID pre `getPointAtLength()`

#### `SensorNode.tsx`
- Diamant na pase, pozicia cez `SVGPathElement.getPointAtLength()`
- Farby: modry (data_check), oranzovy (routing), fialovy (process_decision)
- Flash animacia pri triggeri (CSS `sensor-flash`, 0.6s)
- Pod diamantom zobrazuje `displayId` (napr. S-1001-A)
- Decision label nad diamantom (OK/FAIL/REWORK/SKIP) s 2s fade

#### `TransitPartChip.tsx`
- Animovany chip (modry pill 44x16) nasledujuci cestu pasu
- `requestAnimationFrame` loop + `getPointAtLength(progress * totalLength)`
- Cerveny indikator ak je transit zastaveny (sensor fail)

#### `DetailSlidePanel.tsx`
Slide-in overlay panel z pravej strany (420px), `transition: transform 0.3s`:

**Station detail:**
- DisplayId + nazov, status, typ, area
- Aktualny kus (kliknutelny odkaz na part detail)
- Metriky: Output count, Cycle time, Teplota
- **Result Distribution** — OK/NOK/Rework donut pie chart (`OkNokPieChart`)
- **Live Metrics** — per-metric sparklines s prahmi a status indikatormi (`StationHealthIndicator`)
- Zoznam poslednych kusov (scrollable, kliknutelne)

**Part detail:**
- Part ID, status badge, aktualna stanica (kliknutelna)
- Cas vytvorenia, pocet krokov, area
- Journey timeline (reuse `PartTimeline.tsx`)

#### `EventDrawer.tsx`
- Defaultne collapsed (len lista "Events (N)")
- Klik otvori (max-height 250px, transition)
- Zobrazuje poslednych 100 eventov (ikony, farby, cas, part ID kliknutelny)

#### `PartTimeline.tsx`
- Vertikalny timeline s bodkami (zelene/sede/cervene/oranzove)
- Kazdy zaznam: `#displayId StationName` + result badge + casy + cycle time
- Active zaznamy: zelena pulzujuca badge + progress bar

### CSS Animacie (`index.css`)

| Animacia | Trieda | Trvanie | Popis |
|----------|--------|---------|-------|
| `pulse-station` | `.station-running` | 1.5s | Pulsujuci opacity |
| `conveyor-move` | `.conveyor-animate` | 0.8s | Pohyb ciarok na pase |
| `sensor-flash` | `.sensor-flash` | 0.6s | Rozrastajuci sa kruh |
| `station-glow-pulse` | `.station-glow` | 1.5s | Glow pre selectnutu stanicu |

---

## 9. MQTT topiky

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

## 10. WebSocket spravy

### Backend → Frontend (`WsMessage`)

| Typ | Data | Kedy |
|-----|------|------|
| `init` | parts[], layout, stations, sensors, metricHistory, counters | Pripojenie klienta |
| `part_enter` | partId, stationId, area, line, timestamp | Kus vstupi na stanicu |
| `part_exit` | partId, stationId, result, cycleTimeMs | Kus opusti stanicu |
| `part_process` | partId, stationId, progressPct | Progress spracovania |
| `station_status` | stationId, status, currentPartId | Zmena stavu stanice |
| `metric_update` | stationId, metric, value, unit | Nova metrika (batchovana) |
| `metric_batch` | Array<{stationId, metric, value, unit}> | **Batch metrik** (kazdych 500ms) |
| `transit_start` | partId, from, to, transitTimeMs | Kus zacal transit |
| `transit_stop` | partId, from, to, reason | Kus zastaveny na pase |
| `sensor_trigger` | sensorId, partId, type, decision | Senzor evaluovany |
| `part_created` | Part | Novy kus vytvoreny |
| `part_override` | partId, timestamp | Manuálny override kusu |

> **Metric batching:** Broker neposiela `metric_update` spravy okamzite. Namiesto toho ich zbiera do buffera a kazdych 500ms posle jednu `metric_batch` spravu so vsetkymi nahromadenymi metrikami. Toto je kriticke pri stress teste (1910 metrik by inak bolo 1910 individualnych WS sprav).

### Frontend → Backend (`WsRequest`)

| Typ | Data |
|-----|------|
| `get_part_history` | partId |
| `search_part` | query string |
| `override_part` | partId, fromStationId, toStationId, failedSensorId |

---

## 11. Datovy model

### Zivotny cyklus kusu (Part)

```
CREATED → IN_STATION → IN_TRANSIT → IN_STATION → ... → COMPLETED
                                  ↓                       alebo
                            sensor fail              → SCRAPPED (NOK/fail)
                                  ↓
                              SCRAPPED
```

### Part History

Kazdy kus si pamata kompletnu historiu navstivenych stanic:
```typescript
history: [{
  stationId: "asm-press-01",     // interna ID
  enteredAt: "2026-02-15T14:32:18.000Z",
  exitedAt: "2026-02-15T14:32:42.000Z",
  result: "ok",                  // ok | nok | rework
  cycleTimeMs: 24000,
  progressPct: 100
}, ...]
```

Pri rework sa kus vrati v historii o niekolko stanic spat a cely usek prejde znova.

---

## 12. Factory layout a ID schema

### Vyrobne linky

| Linka | Area | Stanice | Tok |
|-------|------|---------|-----|
| Assembly (line1) | assembly | 5 stanic | Load→Press→Drill→Measure→Inspect |
| Welding (line2) | welding | 6 stanic | Load→Weld A/B (parallel)→Grind→Measure→Inspect |
| Painting (line3) | painting | 5 stanic | Prep→Paint→Cure→Measure→Pack |

### Station Display IDs

| displayId | stationId | Nazov | Typ | Rework Target |
|-----------|-----------|-------|-----|---------------|
| **1001** | asm-load-01 | Loading Dock | load | - |
| **1002** | asm-press-01 | Hydraulic Press | machine | - |
| **1003** | asm-drill-01 | CNC Drill | machine | - |
| **1004** | asm-measure-01 | Quality Check | measure | 1003 (CNC Drill) |
| **1005** | asm-inspect-01 | Final Inspection | inspection | - |
| **2001** | wld-load-01 | Material Feed | load | - |
| **2002** | wld-weld-01 | Welder A | machine | - |
| **2003** | wld-weld-02 | Welder B | machine | - |
| **2004** | wld-grind-01 | Grinder | machine | - |
| **2005** | wld-measure-01 | Weld QC | measure | 2004 (Grinder) |
| **2006** | wld-inspect-01 | Weld Inspection | inspection | - |
| **3001** | pnt-prep-01 | Surface Prep | manual | - |
| **3002** | pnt-paint-01 | Paint Booth | machine | - |
| **3003** | pnt-cure-01 | Curing Oven | machine | - |
| **3004** | pnt-measure-01 | Paint QC | measure | 3002 (Paint Booth) |
| **3005** | pnt-pack-01 | Packing | pack | - |

**ID schema**: 1xxx = Assembly, 2xxx = Welding, 3xxx = Painting

### SVG pozicie

Stanice su rozlozene v SVG viewBox (900x570):
- Assembly (y=100): x = 80, 250, 420, 590, 760
- Welding (y=240-330): x = 80, 250, 250, 420, 590, 760
- Painting (y=470): x = 80, 250, 420, 590, 760

---

## 13. Senzorovy system

### Typy senzorov

| Typ | Farba | Rozhodnutie pri fail | Popis |
|-----|-------|---------------------|-------|
| **data_check** | Modra | `fail` → kus stoji, scrapped | Kontrola dat / kvality materialu |
| **routing** | Oranzova | `rework` → kus sa vracia | Rozhodnutie o rework ceste |
| **process_decision** | Fialova | `skip_process` → skip dalsej stanice | Rozhodnutie ci procesovat na dalsej stanici |

### Sensor Display IDs

Format: `S-{upstream_station_displayId}-{A|B|C}`

Priklad: `S-1001-A` = prvy senzor za stanicou #1001 (Loading Dock)

### Rozmiestnenie senzorov

Kazdy usek dopravneho pasu (medzi 2 stanicami) ma 1-3 senzory:
- `positionOnBelt`: 0.0 (zacatok) az 1.0 (koniec useku)
- `failProbability`: 2-12% sanca na negativny vysledok

### Kompletny zoznam (22 senzorov)

| displayId | Typ | Usek (from→to) | Pozicia | Fail % |
|-----------|-----|-----------------|---------|--------|
| S-1001-A | data_check | 1001→1002 | 0.35 | 5% |
| S-1001-B | routing | 1001→1002 | 0.70 | 8% |
| S-1002-A | data_check | 1002→1003 | 0.30 | 4% |
| S-1002-B | process_decision | 1002→1003 | 0.65 | 10% |
| S-1003-A | data_check | 1003→1004 | 0.40 | 3% |
| S-1003-B | routing | 1003→1004 | 0.75 | 6% |
| S-1004-A | data_check | 1004→1005 | 0.50 | 2% |
| S-2001-A | data_check | 2001→2002 | 0.40 | 5% |
| S-2001-B | routing | 2001→2002 | 0.75 | 7% |
| S-2001-C | data_check | 2001→2003 | 0.40 | 5% |
| S-2002-A | data_check | 2002→2004 | 0.35 | 4% |
| S-2002-B | process_decision | 2002→2004 | 0.70 | 8% |
| S-2003-A | data_check | 2003→2004 | 0.50 | 4% |
| S-2004-A | data_check | 2004→2005 | 0.30 | 3% |
| S-2004-B | routing | 2004→2005 | 0.70 | 5% |
| S-2005-A | data_check | 2005→2006 | 0.50 | 2% |
| S-3001-A | data_check | 3001→3002 | 0.35 | 4% |
| S-3001-B | process_decision | 3001→3002 | 0.70 | 12% |
| S-3002-A | data_check | 3002→3003 | 0.30 | 3% |
| S-3002-B | routing | 3002→3003 | 0.65 | 6% |
| S-3003-A | data_check | 3003→3004 | 0.40 | 3% |
| S-3004-A | data_check | 3004→3005 | 0.50 | 2% |

---

## Zavislosti

### Root
- `concurrently` - paralelne spustenie servicov
- `typescript` - typova kontrola

### Broker
- `aedes` - MQTT broker v Node.js
- `mqtt` - MQTT klient (interny subscriber)
- `ws` - WebSocket server
- `tsx` - TypeScript executor (dev)

### Simulator
- `mqtt` - MQTT klient
- `cross-env` - cross-platform env premenne (dev, pre Windows kompatibilitu)
- `tsx` - TypeScript executor (dev)

### Frontend
- `react`, `react-dom` - UI framework
- `zustand` - state management
- `recharts` - kniznica grafov (sparklines, pie charts)
- `vite` - build tool + dev server
- `tailwindcss` - utility CSS
- `@vitejs/plugin-react` - React HMR

---

## 14. Metrikovy system (V4)

### Station-type metriky

Kazdy typ stanice ma definovanu sadu metrik v `STATION_METRIC_CONFIGS`:

| Typ stanice | Metriky |
|-------------|---------|
| **load** | weight (kg) |
| **machine** | vibration (mm/s), power (kW), temperature (°C) |
| **measure** | dimension (mm), accuracy (%) |
| **inspection** | score (pts), defects (pcs) |
| **manual** | temperature (°C) |
| **pack** | weight (kg) |
| **buffer** | ziadne |

Kazda metrika ma definovane:
- `nominalMin/Max` — zelena zona (normalny prevadzkovy rozsah)
- `warningMin/Max` — zlta zona (varovanie)
- `baseValue` — stredna hodnota pre simulator
- `variance` — rozsah nahodnej zmeny

### Metrikova historia (Ring Buffer)

- **Broker** uklada poslednych **60 vzoriek** per station per metric
- Pri init posle kompletnu historiu novemu WS klientovi
- **Frontend** udrzuje rovnaky ring buffer v Zustand store

### Vizualizacia metrik (Recharts)

**MetricSparkline** — maly AreaChart (120×40 px):
- Zobrazuje poslednych 60 vzoriek
- Zelene referencne ciary pre nominalMin/Max prahy
- Gradient fill (zelena/zlta/cervena podla aktualnej hodnoty)
- Tooltip s hodnotou a casom

**OkNokPieChart** — donut (100×100 px):
- Zelena = OK, Cervena = NOK, Oranzova = Rework
- Centralna hodnota = celkovy pocet
- Tooltip s percentami

**StationHealthIndicator** — riadok per metrika:
- Label | Sparkline | Aktualna hodnota | Status bodka (zelena/zlta/cervena)

### OK/NOK/Rework countery

Kazda stanica pocita kolko kusov preslo s vysledkom OK, NOK alebo Rework. Countery sa inkrementuju pri `part_exit` na strane brokera aj frontendu.

---

## 15. Stress test — 2000 topicov (V4.1)

### Prehlad

Stress test overuje ze architektura zvladne **2000+ MQTT topicov** a **~390 msg/s** bez degradacie UI.

### Aktivacia

```bash
npm run dev:stress    # spusti vsetky 3 servisy, simulator v stress mode
```

Alebo manualne:
```bash
cross-env STRESS_TEST=1 tsx watch src/index.ts   # v simulator package
```

### Co generuje stress test

| Zdroj | Topicov | Msg/s |
|-------|---------|-------|
| Realne stanice (16) | 35 metric topicov | ~7/s |
| Virtualne stanice (125 × 15 metrik) | 1875 metric topicov | ~375/s |
| Part lifecycle, sensors, transit | ~92 topicov | ~7-10/s |
| **Spolu** | **~2002** | **~390/s** |

Virtualne stanice (`virt-001` az `virt-125`) publikuju na `factory/stress/virtual/{virt-xxx}/metrics/{metricId}`.

### Batching architektura

Problem: 390 individualnych WS sprav za sekundu by zahltilo frontend (390× Zustand `set()` = React laguje).

Riesenie — **dvojvrstvovy batching**:

```
Simulator → MQTT (390 msg/s) → Broker buffer (500ms) → 1× metric_batch WS → Frontend 1× set()
```

1. **Broker** zbiera `metric_update` spravy do `metricBatchBuffer[]`
2. Kazdych **500ms** posle vsetky nahromadene metriky ako jednu `metric_batch` spravu
3. **Frontend** `handleMetricBatch()` spracuje vsetky metriky v **jednom** `set()` volani
4. Virtualne stanice sa v store automaticky preskakuju (nie su v layout Mape)

### Performance monitoring

**`perfStats.ts`** — sledovanie vykonnosti mimo Zustand (ziadne zbytocne re-rendery):
- `lastBatchSize` — pocet metrik v poslednom batchi
- `lastBatchStations` — pocet unikatnych stanic
- `lastUpdateMs` — cas store updatu v ms
- `metricsPerSecond` — msg/s (rolling 10s okno)
- `totalMetricsReceived` — celkovy pocet prijatych metrik

**STRESS badge v Header** (zobrazeny len pri stress teste, batch > 50 metrik):
- Pocet topicov v batchi
- Pocet stanic
- msg/s
- Update cas (zelena < 16ms, zlta < 50ms, cervena > 50ms)
- Celkovy pocet prijatych metrik

### Bottleneck analyza

| Riziko | Riesenie | Vysledok |
|--------|----------|----------|
| React 390× `set()`/s | Batch handler — 1× `set()` per 500ms | < 16ms update |
| WS 390 JSON sprav/s | Batch do 1 JSON spravy per 500ms | ~2 spravy/s |
| Aedes 390 msg/s MQTT | Aedes zvladne 10K+ msg/s | OK |
| Ring buffer pamat (2000 × 60 vzoriek) | Len 16 realnych stanic uklada historiu | ~12MB max |
| Init payload (2000 stanic) | Virtualne stanice neposilaju init data | OK |
