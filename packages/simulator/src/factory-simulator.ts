import type { MqttClient } from 'mqtt';
import { getLineRoutes, FACTORY_LAYOUT, STATION_METRIC_CONFIGS } from '@digital-twin/shared';
import type { StationMetricConfig } from '@digital-twin/shared';
import { SimulatedPart } from './simulated-part.js';

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class FactorySimulator {
  private activeParts = new Map<string, SimulatedPart>();
  private partCounter = 0;
  private running = false;
  private createTimer: ReturnType<typeof setTimeout> | null = null;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private readonly lines = getLineRoutes();
  /** Random-walk state: stationId → metricId → current value */
  private metricState = new Map<string, Map<string, number>>();

  constructor(private readonly client: MqttClient) {}

  start() {
    this.running = true;
    console.log(`[simulator] Starting with ${this.lines.length} production lines`);

    // Publish initial station statuses
    for (const [id, station] of Object.entries(FACTORY_LAYOUT.stations)) {
      this.client.publish(
        `factory/${station.area}/${station.line}/${id}/status`,
        JSON.stringify({
          stationId: id,
          status: 'idle',
          timestamp: new Date().toISOString(),
          currentPartId: null,
        }),
      );
    }

    // Start creating parts
    this.scheduleNextPart();

    // Start metrics publishing
    this.metricsTimer = setInterval(() => this.publishMetrics(), 5000);
  }

  stop() {
    this.running = false;
    if (this.createTimer) clearTimeout(this.createTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    for (const part of this.activeParts.values()) {
      part.destroy();
    }
    this.activeParts.clear();
  }

  private scheduleNextPart() {
    if (!this.running) return;

    // Keep 5-8 active parts
    const delay = this.activeParts.size < 5
      ? randomBetween(3000, 6000)
      : randomBetween(8000, 15000);

    this.createTimer = setTimeout(() => {
      if (this.running && this.activeParts.size < 10) {
        this.createPart();
      }
      this.scheduleNextPart();
    }, delay);
  }

  private createPart() {
    this.partCounter++;
    const partId = `PART-${new Date().getFullYear()}-${String(this.partCounter).padStart(5, '0')}`;
    const line = this.lines[Math.floor(Math.random() * this.lines.length)];

    console.log(`[simulator] Creating ${partId} on ${line.lineId} (${line.area})`);

    const part = new SimulatedPart(
      partId,
      line.stations,
      line.area,
      line.lineId,
      this.client,
      (id) => {
        this.activeParts.delete(id);
        console.log(`[simulator] ${id} completed/scrapped (active: ${this.activeParts.size})`);
      },
    );

    this.activeParts.set(partId, part);
    part.start();
  }

  private publishMetrics() {
    for (const [id, station] of Object.entries(FACTORY_LAYOUT.stations)) {
      const configs = STATION_METRIC_CONFIGS[station.type] ?? [];
      if (configs.length === 0) continue;

      // Ensure we have random-walk state for this station
      if (!this.metricState.has(id)) {
        const stationMetrics = new Map<string, number>();
        for (const cfg of configs) {
          stationMetrics.set(cfg.metricId, cfg.baseValue);
        }
        this.metricState.set(id, stationMetrics);
      }
      const stateMap = this.metricState.get(id)!;

      for (const cfg of configs) {
        // Random walk: drift toward base value with some noise
        let current = stateMap.get(cfg.metricId) ?? cfg.baseValue;
        const drift = (cfg.baseValue - current) * 0.1; // mean-reverting
        const noise = (Math.random() - 0.5) * cfg.variance * 0.4;
        current = current + drift + noise;
        // Clamp to reasonable bounds
        current = Math.max(cfg.warningMin - cfg.variance * 0.2, Math.min(cfg.warningMax + cfg.variance * 0.2, current));
        current = Math.round(current * 100) / 100;
        stateMap.set(cfg.metricId, current);

        this.client.publish(
          `factory/${station.area}/${station.line}/${id}/metrics/${cfg.metricId}`,
          JSON.stringify({
            stationId: id,
            value: current,
            unit: cfg.unit,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    }
  }
}
