// ---- Area Types ----

export interface AreaConfig {
  areaId: string;
  name: string;
  color: string;
  bounds: { x: number; y: number; w: number; h: number };
  stationIds: string[];
}

// ---- Station Types ----

export interface StationConfig {
  stationId: string;
  name: string;
  area: string;
  mqttTopic: string;
  isAliveTopic: string;
  position: { x: number; y: number };
  nextStations: string[];
}

export interface StationState {
  stationId: string;
  status: 'online' | 'offline';
  lastValue: Record<string, unknown> | null;
  lastUpdated: string | null;
  lastAliveAt: string | null;
}

export interface FactoryLayout {
  areas: AreaConfig[];
  stations: Record<string, StationConfig>;
}

// ---- WebSocket Messages ----

export type WsMessage =
  | { type: 'init'; data: { layout: FactoryLayout; stations: Record<string, StationState> } }
  | { type: 'station_update'; data: { stationId: string; value: Record<string, unknown>; timestamp: string } }
  | { type: 'station_status'; data: { stationId: string; status: 'online' | 'offline' } };
