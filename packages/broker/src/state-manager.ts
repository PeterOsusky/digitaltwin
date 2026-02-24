import type { StationState, FactoryLayout, WsMessage } from '@digital-twin/shared';
import { FACTORY_LAYOUT } from '@digital-twin/shared';

/** Stations without isAlive for this long are marked offline */
const ALIVE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class StateManager {
  stations = new Map<string, StationState>();
  layout: FactoryLayout = FACTORY_LAYOUT;

  constructor() {
    for (const id of Object.keys(this.layout.stations)) {
      this.stations.set(id, {
        stationId: id,
        status: 'offline',
        lastValue: null,
        lastUpdated: null,
        lastAliveAt: null,
      });
    }
  }

  /** Handle data message for a station */
  handleStationUpdate(stationId: string, value: Record<string, unknown>, timestamp: string): boolean {
    const station = this.stations.get(stationId);
    if (!station) return false;

    station.lastValue = value;
    station.lastUpdated = timestamp;
    return true;
  }

  /** Handle isAlive heartbeat. Returns true if station status changed to online. */
  handleAlive(stationId: string, timestamp: string): boolean {
    const station = this.stations.get(stationId);
    if (!station) return false;

    station.lastAliveAt = timestamp;
    if (station.status === 'offline') {
      station.status = 'online';
      return true; // status changed
    }
    return false;
  }

  /**
   * Check all stations for alive timeout.
   * Returns list of WsMessages for stations that just went offline.
   */
  checkAliveTimeouts(): WsMessage[] {
    const now = Date.now();
    const messages: WsMessage[] = [];

    for (const [id, station] of this.stations) {
      if (station.status !== 'online') continue;

      if (!station.lastAliveAt) {
        station.status = 'offline';
        messages.push({ type: 'station_status', data: { stationId: id, status: 'offline' } });
        continue;
      }

      const aliveTime = new Date(station.lastAliveAt).getTime();
      if (now - aliveTime > ALIVE_TIMEOUT_MS) {
        station.status = 'offline';
        console.log(`[broker] Station ${id} went offline (no isAlive for 5 min)`);
        messages.push({ type: 'station_status', data: { stationId: id, status: 'offline' } });
      }
    }

    return messages;
  }

  getInitData() {
    const stationsObj: Record<string, StationState> = {};
    for (const [id, station] of this.stations) {
      stationsObj[id] = { ...station };
    }

    return {
      layout: this.layout,
      stations: stationsObj,
    };
  }
}
