import type { MqttClient } from 'mqtt';
import { FACTORY_LAYOUT } from '@digital-twin/shared';

export class FactorySimulator {
  private running = false;
  private dataTimer: ReturnType<typeof setInterval> | null = null;
  private aliveTimer: ReturnType<typeof setInterval> | null = null;
  private partCounter = Math.floor(Date.now() / 1000) % 100000;

  constructor(private readonly client: MqttClient) {}

  start() {
    this.running = true;
    const stations = Object.values(FACTORY_LAYOUT.stations);
    console.log(`[simulator] Starting with ${stations.length} stations`);

    // Send initial isAlive for all stations immediately
    this.publishAlive(stations);

    // Publish isAlive heartbeat every 30 seconds
    this.aliveTimer = setInterval(() => {
      if (!this.running) return;
      this.publishAlive(stations);
    }, 30_000);

    // Publish OK/NOK data for each station every 1.5 seconds
    this.dataTimer = setInterval(() => {
      if (!this.running) return;

      for (const station of stations) {
        this.partCounter++;
        const partId = `PART-${new Date().getFullYear()}-${String(this.partCounter).padStart(5, '0')}`;
        const result = Math.random() < 0.85 ? 'ok' : 'nok';
        const payload = JSON.stringify({
          partId,
          result,
          timestamp: new Date().toISOString(),
        });

        this.client.publish(station.mqttTopic, payload);
      }
    }, 1500);
  }

  stop() {
    this.running = false;
    if (this.dataTimer) {
      clearInterval(this.dataTimer);
      this.dataTimer = null;
    }
    if (this.aliveTimer) {
      clearInterval(this.aliveTimer);
      this.aliveTimer = null;
    }
  }

  private publishAlive(stations: typeof FACTORY_LAYOUT.stations[keyof typeof FACTORY_LAYOUT.stations][]) {
    const timestamp = new Date().toISOString();
    for (const station of stations) {
      this.client.publish(
        station.isAliveTopic,
        JSON.stringify({ timestamp }),
      );
    }
    console.log(`[simulator] Sent isAlive for ${stations.length} stations`);
  }
}
