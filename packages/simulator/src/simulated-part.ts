import type { MqttClient } from 'mqtt';
import { FACTORY_LAYOUT, SENSOR_CONFIG, type StationConfig, type ExitResult, type SensorConfig, type SensorDecision } from '@digital-twin/shared';

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function publish(client: MqttClient, topic: string, payload: Record<string, unknown>) {
  client.publish(topic, JSON.stringify(payload));
}

const WAIT_POLL_MS = 500;

export class SimulatedPart {
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private currentProgress = 0;
  public completed = false;
  private pendingTimers: ReturnType<typeof setTimeout>[] = [];
  /** Track what this part currently holds so destroy() can release */
  private heldStation: string | null = null;
  private heldBelt: string | null = null;

  constructor(
    public readonly partId: string,
    private readonly lineStations: string[],
    private readonly area: string,
    private readonly line: string,
    private readonly client: MqttClient,
    private readonly occupiedStations: Set<string>,
    private readonly occupiedBelts: Set<string>,
    private readonly onComplete: (partId: string) => void,
  ) {}

  start() {
    this.enterStation(0);
  }

  private getStation(stationId: string): StationConfig {
    return FACTORY_LAYOUT.stations[stationId];
  }

  private topicBase(stationId: string): string {
    const s = this.getStation(stationId);
    return `factory/${s.area}/${s.line}/${s.stationId}`;
  }

  private static beltKey(fromId: string, toId: string): string {
    return `${fromId}__${toId}`;
  }

  private enterStation(stationIndex: number, skipProcess = false) {
    if (this.completed) return;

    const stationId = this.lineStations[stationIndex];

    // Wait if station is occupied
    if (this.occupiedStations.has(stationId)) {
      const timer = setTimeout(() => this.enterStation(stationIndex, skipProcess), WAIT_POLL_MS);
      this.pendingTimers.push(timer);
      return;
    }

    // Claim the station
    this.occupiedStations.add(stationId);
    this.heldStation = stationId;

    const now = new Date().toISOString();

    publish(this.client, `${this.topicBase(stationId)}/part/enter`, {
      partId: this.partId, timestamp: now, stationId, area: this.area, line: this.line,
    });

    // Skip process: part passes through without processing (sensor decision)
    if (skipProcess) {
      const timer = setTimeout(() => {
        this.exitStation(stationIndex, stationId, 0);
      }, 500);
      this.pendingTimers.push(timer);
      return;
    }

    // Normal processing
    this.currentProgress = 0;
    const station = this.getStation(stationId);
    const [minTime, maxTime] = station.processingTime;
    const processingTime = randomBetween(minTime, maxTime);
    const progressStep = 100 / (processingTime / 2000);

    this.progressInterval = setInterval(() => {
      this.currentProgress = Math.min(99, this.currentProgress + progressStep + Math.random() * 5);
      publish(this.client, `${this.topicBase(stationId)}/part/process`, {
        partId: this.partId, timestamp: new Date().toISOString(),
        stationId, progressPct: Math.round(this.currentProgress),
      });
    }, 2000);

    const timer = setTimeout(() => {
      this.exitStation(stationIndex, stationId, processingTime);
    }, processingTime);
    this.pendingTimers.push(timer);
  }

  private exitStation(stationIndex: number, stationId: string, cycleTimeMs: number) {
    if (this.completed) return;

    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }

    const station = this.getStation(stationId);
    const now = new Date().toISOString();

    // Determine result at measure stations
    let result: ExitResult = 'ok';
    if (station.type === 'measure') {
      const roll = Math.random();
      if (roll < 0.03) result = 'nok';
      else if (roll < 0.15) result = 'rework';
    }

    publish(this.client, `${this.topicBase(stationId)}/part/exit`, {
      partId: this.partId, timestamp: now, stationId,
      area: this.area, line: this.line, result, cycleTimeMs,
    });

    // Release station occupancy
    this.occupiedStations.delete(stationId);
    this.heldStation = null;

    if (result === 'nok') {
      this.finish();
      return;
    }

    if (result === 'rework' && station.reworkTarget) {
      const reworkIdx = this.lineStations.indexOf(station.reworkTarget);
      if (reworkIdx >= 0) {
        this.transitToStation(stationId, reworkIdx, randomBetween(3000, 6000));
        return;
      }
    }

    if (station.nextStations.length === 0) {
      this.finish();
      return;
    }

    // Pick next station
    const nextStationId = station.nextStations[Math.floor(Math.random() * station.nextStations.length)];
    const nextIdx = this.lineStations.indexOf(nextStationId);
    if (nextIdx >= 0) {
      this.transitToStation(stationId, nextIdx, randomBetween(3000, 6000));
    } else {
      this.finish();
    }
  }

  // ---- Transit with sensor evaluation ----

  private transitToStation(fromStationId: string, nextStationIndex: number, transitTime: number, skipProcess = false) {
    if (this.completed) return;

    const toStationId = this.lineStations[nextStationIndex];
    const beltKey = SimulatedPart.beltKey(fromStationId, toStationId);

    // Wait if belt segment is occupied
    if (this.occupiedBelts.has(beltKey)) {
      const timer = setTimeout(() => this.transitToStation(fromStationId, nextStationIndex, transitTime, skipProcess), WAIT_POLL_MS);
      this.pendingTimers.push(timer);
      return;
    }

    // Claim the belt
    this.occupiedBelts.add(beltKey);
    this.heldBelt = beltKey;

    // Publish transit start
    publish(this.client, `factory/${this.area}/${this.line}/transit/start`, {
      partId: this.partId, fromStationId, toStationId,
      transitTimeMs: transitTime, timestamp: new Date().toISOString(),
    });

    // Get sensors on this belt segment
    const sensors = SENSOR_CONFIG
      .filter(s => s.fromStationId === fromStationId && s.toStationId === toStationId)
      .sort((a, b) => a.positionOnBelt - b.positionOnBelt);

    if (sensors.length === 0) {
      const timer = setTimeout(() => {
        this.occupiedBelts.delete(beltKey);
        this.heldBelt = null;
        this.enterStation(nextStationIndex, skipProcess);
      }, transitTime);
      this.pendingTimers.push(timer);
      return;
    }

    this.evaluateSensorsSequentially(sensors, 0, fromStationId, toStationId, nextStationIndex, transitTime, skipProcess, beltKey);
  }

  private evaluateSensorsSequentially(
    sensors: SensorConfig[], index: number,
    fromStationId: string, toStationId: string,
    nextStationIndex: number, totalTransitTime: number,
    skipProcess: boolean, beltKey: string,
  ) {
    if (this.completed) return;

    if (index >= sensors.length) {
      // All sensors passed - finish transit
      const lastPos = sensors[sensors.length - 1].positionOnBelt;
      const remainingTime = Math.max(200, totalTransitTime * (1.0 - lastPos));
      const timer = setTimeout(() => {
        this.occupiedBelts.delete(beltKey);
        this.heldBelt = null;
        this.enterStation(nextStationIndex, skipProcess);
      }, remainingTime);
      this.pendingTimers.push(timer);
      return;
    }

    const sensor = sensors[index];
    const prevPos = index > 0 ? sensors[index - 1].positionOnBelt : 0;
    const delayToSensor = Math.max(100, totalTransitTime * (sensor.positionOnBelt - prevPos));

    const timer = setTimeout(() => {
      if (this.completed) return;

      const decision = this.evaluateSensor(sensor);

      // Publish sensor trigger
      publish(this.client, `factory/${this.area}/${this.line}/sensor/${sensor.sensorId}/trigger`, {
        sensorId: sensor.sensorId, partId: this.partId, type: sensor.type,
        decision, timestamp: new Date().toISOString(),
        fromStationId, toStationId,
      });

      switch (decision) {
        case 'pass':
          this.evaluateSensorsSequentially(sensors, index + 1, fromStationId, toStationId, nextStationIndex, totalTransitTime, skipProcess, beltKey);
          break;

        case 'fail':
          // Data check failed - part stops on belt, release belt
          this.occupiedBelts.delete(beltKey);
          this.heldBelt = null;
          publish(this.client, `factory/${this.area}/${this.line}/transit/stop`, {
            partId: this.partId, fromStationId, toStationId,
            reason: 'sensor_data_check_fail', timestamp: new Date().toISOString(),
          });
          this.finish();
          break;

        case 'rework':
          // Routing sensor says go back — release current belt first
          this.occupiedBelts.delete(beltKey);
          this.heldBelt = null;
          this.transitToStation(toStationId, this.lineStations.indexOf(fromStationId), randomBetween(3000, 6000));
          break;

        case 'skip_process':
          // Continue transit but skip processing at next station
          this.evaluateSensorsSequentially(sensors, index + 1, fromStationId, toStationId, nextStationIndex, totalTransitTime, true, beltKey);
          break;
      }
    }, delayToSensor);
    this.pendingTimers.push(timer);
  }

  private evaluateSensor(sensor: SensorConfig): SensorDecision {
    const roll = Math.random();
    if (roll < sensor.failProbability) {
      switch (sensor.type) {
        case 'data_check': return 'fail';
        case 'routing': return 'rework';
        case 'process_decision': return 'skip_process';
      }
    }
    return 'pass';
  }

  private finish() {
    this.completed = true;
    this.onComplete(this.partId);
  }

  destroy() {
    this.completed = true;
    if (this.progressInterval) clearInterval(this.progressInterval);
    for (const timer of this.pendingTimers) clearTimeout(timer);
    this.pendingTimers = [];
    // Release any held resources
    if (this.heldStation) {
      this.occupiedStations.delete(this.heldStation);
      this.heldStation = null;
    }
    if (this.heldBelt) {
      this.occupiedBelts.delete(this.heldBelt);
      this.heldBelt = null;
    }
  }
}
