import type { WsMessage, ExitResult, StationStatus, SensorDecision, SensorType } from '@digital-twin/shared';
import type { StateManager } from './state-manager.js';

export function processMessage(
  topic: string,
  payload: Buffer,
  state: StateManager,
): WsMessage | null {
  const parts = topic.split('/');
  if (parts[0] !== 'factory' || parts.length < 4) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    return null;
  }

  const area = parts[1];
  const line = parts[2];
  const segment = parts[3]; // station ID, 'transit', or 'sensor'

  // Transit topics: factory/{area}/{line}/transit/start|stop
  if (segment === 'transit') {
    const action = parts[4]; // 'start' or 'stop'
    if (action === 'start') {
      const accepted = state.handleTransitStart(
        data.partId as string,
        data.fromStationId as string,
        data.toStationId as string,
        data.transitTimeMs as number,
        data.timestamp as string,
      );
      if (!accepted) return null; // Completed/scrapped parts cannot transit
      return {
        type: 'transit_start',
        data: {
          partId: data.partId as string,
          fromStationId: data.fromStationId as string,
          toStationId: data.toStationId as string,
          transitTimeMs: data.transitTimeMs as number,
          timestamp: data.timestamp as string,
        },
      };
    }
    if (action === 'stop') {
      state.handleTransitStop(data.partId as string, data.timestamp as string);
      return {
        type: 'transit_stop',
        data: {
          partId: data.partId as string,
          fromStationId: data.fromStationId as string,
          toStationId: data.toStationId as string,
          reason: data.reason as string,
          timestamp: data.timestamp as string,
        },
      };
    }
    return null;
  }

  // Sensor topics: factory/{area}/{line}/sensor/{sensorId}/trigger
  if (segment === 'sensor') {
    const sensorId = parts[4];
    const action = parts[5]; // 'trigger'
    if (action === 'trigger') {
      state.handleSensorTrigger(
        sensorId,
        data.partId as string,
        data.type as SensorType,
        data.decision as SensorDecision,
        data.timestamp as string,
      );
      return {
        type: 'sensor_trigger',
        data: {
          sensorId,
          partId: data.partId as string,
          type: data.type as SensorType,
          decision: data.decision as SensorDecision,
          timestamp: data.timestamp as string,
          fromStationId: data.fromStationId as string,
          toStationId: data.toStationId as string,
        },
      };
    }
    return null;
  }

  // Station topics: factory/{area}/{line}/{stationId}/{...path}
  const station = segment;
  const path = parts.slice(4);
  const pathKey = path.join('/');

  switch (pathKey) {
    case 'part/enter': {
      const partId = data.partId as string;
      const timestamp = data.timestamp as string;
      const accepted = state.handlePartEnter(partId, station, area, line, timestamp);
      if (!accepted) return null; // Completed/scrapped parts cannot re-enter
      return {
        type: 'part_enter',
        data: { partId, timestamp, stationId: station, area, line },
      };
    }

    case 'part/exit': {
      const partId = data.partId as string;
      const timestamp = data.timestamp as string;
      const result = data.result as ExitResult;
      const cycleTimeMs = data.cycleTimeMs as number;
      const accepted = state.handlePartExit(partId, station, result, cycleTimeMs, timestamp);
      if (!accepted) return null; // Completed/scrapped parts cannot exit again
      return {
        type: 'part_exit',
        data: { partId, timestamp, stationId: station, area, line, result, cycleTimeMs },
      };
    }

    case 'part/process': {
      const partId = data.partId as string;
      const timestamp = data.timestamp as string;
      const progressPct = data.progressPct as number;
      state.handlePartProcess(partId, station, progressPct);
      return {
        type: 'part_process',
        data: { partId, timestamp, stationId: station, progressPct },
      };
    }

    case 'status': {
      const status = data.status as StationStatus;
      const currentPartId = (data.currentPartId as string) ?? null;
      state.handleStationStatus(station, status, currentPartId);
      return {
        type: 'station_status',
        data: { stationId: station, status, timestamp: data.timestamp as string, currentPartId },
      };
    }

    default: {
      if (path[0] === 'metrics' && path[1]) {
        const metric = path[1];
        const value = data.value as number;
        const unit = (data.unit as string) ?? '';
        state.handleMetric(station, metric, value);
        return {
          type: 'metric_update',
          data: { stationId: station, metric, value, unit },
        };
      }
      return null;
    }
  }
}
