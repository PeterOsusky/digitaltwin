import type { WsMessage } from '@digital-twin/shared';
import { getDataTopicMap, getAliveTopicMap } from '@digital-twin/shared';
import type { StateManager } from './state-manager.js';

const dataTopicMap = getDataTopicMap();
const aliveTopicMap = getAliveTopicMap();

export function processMessage(
  topic: string,
  payload: Buffer,
  state: StateManager,
): WsMessage | null {
  // Check if this is an isAlive heartbeat
  const aliveStationId = aliveTopicMap.get(topic);
  if (aliveStationId) {
    const timestamp = new Date().toISOString();
    const statusChanged = state.handleAlive(aliveStationId, timestamp);
    if (statusChanged) {
      return {
        type: 'station_status',
        data: { stationId: aliveStationId, status: 'online' },
      };
    }
    return null; // alive received but no status change
  }

  // Check if this is a data topic
  const dataStationId = dataTopicMap.get(topic);
  if (!dataStationId) return null;

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    return null;
  }

  const timestamp = (data.timestamp as string) ?? new Date().toISOString();
  const accepted = state.handleStationUpdate(dataStationId, data, timestamp);
  if (!accepted) return null;

  return {
    type: 'station_update',
    data: { stationId: dataStationId, value: data, timestamp },
  };
}
