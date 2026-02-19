# Digital Twin POC - Task Tracking

## V5: Read-Only Real-Time + Topic Data Viewer

### Princip
- Aedes broker spracuva kazdu MQTT spravu okamzite, state-manager update okamzity
- **WS vrstva v server.ts posiela metric_update okamzite** — ziadny batch na serveri
- **FE WebSocket vrstva** zbiera metric_update do internej Map (mimo Zustand)
- FE refreshuje UI cez requestAnimationFrame / setInterval batch → 1x set() do Zustand
- Ziadna historia, iba posledny stav
- Zrusit override

### Faza 1: Broker — zrusit WS batching + override
- [ ] server.ts: zrusit metricBatchBuffer, startMetricBatching(), batch timer, batch logiku
- [ ] server.ts: metric_update sa broadcastne okamzite (rovnako ako kazda ina WsMessage)
- [ ] server.ts: zrusit simulatePartResume() (150 riadkov) + override_part case
- [ ] state-manager: zrusit metricHistory ring buffer + METRIC_HISTORY_SIZE
- [ ] state-manager: zrusit handlePartOverride()
- [ ] state-manager: zrusit Part.history tracking (push v enter, update v exit/process)
- [ ] state-manager: pridat Part.progressPct, zjednodusit getInitData

### Faza 2: Shared + FE types
- [ ] shared/types.ts: zrusit PartHistoryEntry, Part.history, Part.sensorEvents
- [ ] shared/types.ts: zrusit MetricSample, StationState.metricHistory
- [ ] shared/types.ts: zrusit metric_batch z WsMessage, part_override z WsMessage
- [ ] shared/types.ts: zrusit override_part z WsRequest
- [ ] shared/types.ts: pridat Part.progressPct
- [ ] frontend/types.ts: mirror vsetky zmeny

### Faza 3: FE — metricBuffer (FE-side batching)
- [ ] Novy `metricBuffer.ts` mimo Zustand — Map<topicKey, {stationId, metric, value, unit, timestamp}>
- [ ] pushMetric() funkcia — volana z useWebSocket pri kazdej metric_update sprave
- [ ] flushMetrics() — vrati a vycisti buffer, volane z batch loopu
- [ ] startMetricBatchLoop() — setInterval 500ms → flush → store.handleMetricFlush()
- [ ] Aj ukladat VSETKY topicy pre Topic Data Viewer (nikdy neprecistene)

### Faza 4: FE store cleanup
- [ ] Novy handleMetricFlush(items) — 1x set() pre cely batch
- [ ] Zrusit handleMetricBatch (stary broker-batch handler)
- [ ] Zrusit history tracking z handlePartEnter/Exit/Process
- [ ] Zrusit handlePartOverride, getStationHistory
- [ ] Zrusit metricHistory ring buffer z handleMetricUpdate
- [ ] Zjednodusit getStats — counters namiesto history iteracie

### Faza 5: FE UI cleanup
- [ ] DetailSlidePanel: zrusit override, PartTimeline, sparklines, recent parts
- [ ] useWebSocket: metric_update → pushMetric(); zrusit metric_batch/part_override case

### Faza 6: Topic Data Viewer
- [ ] TopicDataViewer komponent — virtualizovany scrollable list 1900+ topicov
  - Topic key (stationId/metric) | Value | Unit | Age
  - Search/filter input
  - Pocet unikatnych topicov
- [ ] Integovat do UI (toggle panel alebo tab vedla factory mapy)

### Faza 7: Cleanup
- [ ] Zmazat PartTimeline.tsx, MetricSparkline.tsx, StationHealthIndicator.tsx
- [ ] Cleanup nepotrrebnych importov

---

## Completed
- [x] V1-V4.1
