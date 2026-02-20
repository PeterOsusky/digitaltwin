# Digital Twin POC - Task Tracking

## Completed

### V1-V4.1: Base implementation + Metrics + Stress Test
- [x] npm workspaces monorepo (shared, broker, simulator, frontend)
- [x] Aedes MQTT broker + WebSocket bridge
- [x] Factory simulator (parts, stations, sensors)
- [x] React frontend (SVG map, Zustand store)
- [x] Station-type metrics (Recharts sparklines, pie charts)
- [x] Stress test (2000 topics, metric batching)

### V5: Read-Only Real-Time Rework
- [x] Faza 1: Broker — zrusit WS batching, override, metricHistory ring buffer
- [x] Faza 2: Shared + FE types — zrusit Part.history, PartHistoryEntry, MetricSample, metric_batch
- [x] Faza 3: FE metricBuffer (FE-side batching mimo Zustand)
- [x] Faza 4: FE store cleanup — novy handleMetricFlush, zrusit history tracking
- [x] Faza 5: FE UI cleanup — zrusit override, PartTimeline, sparklines
- [x] Faza 6: TopicDataViewer komponent (fullscreen overlay, filter, 1900+ topicov)
- [x] Faza 7: Cleanup — zmazat nepouzivane subory

### V5.1: Read-Only UI
- [x] Odstranit klikanie na stanice, kusy, senzory
- [x] Odstranit DetailSlidePanel, OkNokPieChart, LiveEventFeed
- [x] Odstranit selectedPartId/selectedStationId/selectedSensorId zo store
- [x] Odstranit search z Header
- [x] EventDrawer — part ID ako plain text (nie button)

### V5.2: Scrapped Part Fixes
- [x] Broker state-manager — zrusit guardy pre scrapped/completed v handlePartEnter/Exit/TransitStart
- [x] FE store handleTransitStop — auto-remove stopped transit po 5s
- [x] Unique part IDs — partCounter seeded z Date.now()

### V5.3: Station Occupancy
- [x] FactorySimulator — occupiedStations + occupiedBelts (Set<string>)
- [x] SimulatedPart — enterStation() caka ak obsadene (polling 500ms)
- [x] SimulatedPart — exitStation() uvolni stanicu
- [x] SimulatedPart — transitToStation() caka ak belt obsadeny
- [x] SimulatedPart — destroy() uvolni drzane zdroje (heldStation/heldBelt)

### V6: Scale to 200 Stations
- [x] factory-config.ts — programove generovanie 200 stanic (10 oblasti × 2 linky × 10 stanic)
- [x] SVG viewBox zvacseny na 1600×900
- [x] StationNode zmenseny na 44×20 px
- [x] ConveyorBelt offsety aktualizovane (22/10 px)
- [x] SensorNode zmenseny (4px diamond)
- [x] TransitPartChip zmenseny (r=5)
- [x] FactoryFloorMap — 10 area backgrounds v 2×5 gride
- [x] Simulator — 30-60 aktivnych kusov, 20 liniek

### V6.1: Documentation Update
- [x] ARCHITECTURE.md — kompletny rewrite (200 stanic, read-only, FE batching, occupancy, priklady kodu)
- [x] tasks/todo.md — aktualizacia na sucasny stav
