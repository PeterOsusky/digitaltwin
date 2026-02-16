import type { MqttClient } from 'mqtt';
import { getLineRoutes, FACTORY_LAYOUT } from '@digital-twin/shared';
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
      // Temperature - fluctuate around a base
      const baseTemp = station.type === 'machine' ? 65 : station.type === 'manual' ? 22 : 35;
      const temp = baseTemp + (Math.random() - 0.5) * 10;

      this.client.publish(
        `factory/${station.area}/${station.line}/${id}/metrics/temperature`,
        JSON.stringify({
          stationId: id,
          value: Math.round(temp * 10) / 10,
          unit: 'celsius',
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}
