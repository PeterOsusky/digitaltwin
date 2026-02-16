import type { Part, StationState, SensorState, FactoryLayout, ExitResult, StationStatus, SensorType, SensorDecision } from '@digital-twin/shared';
import { FACTORY_LAYOUT } from '@digital-twin/shared';

export class StateManager {
  parts = new Map<string, Part>();
  stations = new Map<string, StationState>();
  sensors = new Map<string, SensorState>();
  layout: FactoryLayout = FACTORY_LAYOUT;

  constructor() {
    for (const [id] of Object.entries(this.layout.stations)) {
      this.stations.set(id, {
        stationId: id, status: 'idle', currentPartId: null, metrics: { outputCount: 0 },
      });
    }
    for (const sensor of this.layout.sensors) {
      this.sensors.set(sensor.sensorId, {
        sensorId: sensor.sensorId, lastTriggeredAt: null,
        lastDecision: null, lastPartId: null, isActive: false,
      });
    }
  }

  handlePartEnter(partId: string, stationId: string, area: string, line: string, timestamp: string): boolean {
    let part = this.parts.get(partId);
    if (!part) {
      part = {
        partId, createdAt: timestamp, status: 'in_station',
        currentStation: stationId, currentArea: area, currentLine: line, history: [],
      };
      this.parts.set(partId, part);
    } else if (part.status === 'completed' || part.status === 'scrapped') {
      // Completed/scrapped parts must NEVER re-enter production
      return false;
    }
    part.status = 'in_station';
    part.currentStation = stationId;
    part.currentArea = area;
    part.currentLine = line;
    part.history.push({
      stationId, area, line, enteredAt: timestamp,
      exitedAt: null, result: null, cycleTimeMs: null, progressPct: 0,
    });
    const station = this.stations.get(stationId);
    if (station) { station.status = 'running'; station.currentPartId = partId; }
    return true;
  }

  handlePartExit(partId: string, stationId: string, result: ExitResult, cycleTimeMs: number, timestamp: string): boolean {
    const part = this.parts.get(partId);
    if (!part) return false;
    if (part.status === 'completed' || part.status === 'scrapped') return false;
    const entry = [...part.history].reverse().find(h => h.stationId === stationId && !h.exitedAt);
    if (entry) {
      entry.exitedAt = timestamp; entry.result = result;
      entry.cycleTimeMs = cycleTimeMs; entry.progressPct = 100;
    }
    const stationConfig = this.layout.stations[stationId];
    if (result === 'nok') { part.status = 'scrapped'; part.currentStation = null; }
    else if (stationConfig && stationConfig.nextStations.length === 0) { part.status = 'completed'; part.currentStation = null; }
    else { part.status = 'in_transit'; part.currentStation = null; }

    const station = this.stations.get(stationId);
    if (station) {
      station.status = 'idle'; station.currentPartId = null;
      station.metrics.outputCount = (station.metrics.outputCount ?? 0) + 1;
      station.metrics.cycleTime = cycleTimeMs;
    }
    return true;
  }

  handlePartProcess(partId: string, stationId: string, progressPct: number): void {
    const part = this.parts.get(partId);
    if (!part) return;
    const entry = [...part.history].reverse().find(h => h.stationId === stationId && !h.exitedAt);
    if (entry) entry.progressPct = progressPct;
  }

  handleStationStatus(stationId: string, status: StationStatus, currentPartId: string | null): void {
    const station = this.stations.get(stationId);
    if (station) { station.status = status; station.currentPartId = currentPartId; }
  }

  handleMetric(stationId: string, metric: string, value: number): void {
    const station = this.stations.get(stationId);
    if (!station) return;
    if (metric === 'temperature') station.metrics.temperature = value;
    else if (metric === 'cycle_time') station.metrics.cycleTime = value;
    else if (metric === 'output_count') station.metrics.outputCount = value;
  }

  handleTransitStart(partId: string, fromStationId: string, toStationId: string, transitTimeMs: number, timestamp: string): boolean {
    const part = this.parts.get(partId);
    if (!part) return false;
    if (part.status === 'completed' || part.status === 'scrapped') return false;
    part.status = 'in_transit'; part.currentStation = null;
    return true;
  }

  handleTransitStop(partId: string, timestamp: string): void {
    const part = this.parts.get(partId);
    if (part) { part.status = 'scrapped'; part.currentStation = null; }
  }

  handleSensorTrigger(sensorId: string, partId: string, type: SensorType, decision: SensorDecision, timestamp: string): void {
    const sensor = this.sensors.get(sensorId);
    if (sensor) {
      sensor.lastTriggeredAt = timestamp;
      sensor.lastDecision = decision;
      sensor.lastPartId = partId;
      sensor.isActive = true;
      setTimeout(() => { sensor.isActive = false; }, 2000);
    }
  }

  handlePartOverride(partId: string): Part | null {
    const part = this.parts.get(partId);
    if (!part) return null;
    // Reset from scrapped → in_transit so the part can continue
    part.status = 'in_transit';
    return part;
  }

  getInitData() {
    return {
      parts: [...this.parts.values()],
      layout: this.layout,
      stations: Object.fromEntries(this.stations),
      sensors: Object.fromEntries(this.sensors),
    };
  }

  searchParts(query: string): Part[] {
    const q = query.toLowerCase();
    return [...this.parts.values()].filter(p => p.partId.toLowerCase().includes(q)).slice(0, 20);
  }
}
