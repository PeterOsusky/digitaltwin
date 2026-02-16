// ---- Part Tracking ----

export type PartStatus = 'in_station' | 'in_transit' | 'completed' | 'scrapped';
export type StationStatus = 'online' | 'offline' | 'error' | 'idle' | 'running';
export type ExitResult = 'ok' | 'nok' | 'rework';
export type StationType = 'load' | 'machine' | 'inspection' | 'measure' | 'buffer' | 'manual' | 'pack';

export interface PartHistoryEntry {
  stationId: string;
  area: string;
  line: string;
  enteredAt: string;
  exitedAt: string | null;
  result: ExitResult | null;
  cycleTimeMs: number | null;
  progressPct: number;
}

export interface Part {
  partId: string;
  createdAt: string;
  status: PartStatus;
  currentStation: string | null;
  currentArea: string | null;
  currentLine: string | null;
  history: PartHistoryEntry[];
}

// ---- Factory Layout ----

export interface StationPosition {
  x: number;
  y: number;
}

export interface StationConfig {
  stationId: string;
  displayId: string;
  name: string;
  area: string;
  line: string;
  type: StationType;
  position: StationPosition;
  /** Station IDs that follow this one (usually 1, but can be multiple for parallel paths) */
  nextStations: string[];
  /** If this is a measure station, which station to rework to on failure */
  reworkTarget?: string;
  /** Processing time range in ms [min, max] */
  processingTime: [number, number];
}

export interface StationState {
  stationId: string;
  status: StationStatus;
  currentPartId: string | null;
  metrics: {
    temperature?: number;
    cycleTime?: number;
    outputCount?: number;
  };
}

export interface LineConfig {
  lineId: string;
  area: string;
  name: string;
  /** Ordered station IDs - first is entry point */
  stations: string[];
}

export interface AreaConfig {
  areaId: string;
  name: string;
  lines: LineConfig[];
}

export interface FactoryLayout {
  areas: AreaConfig[];
  stations: Record<string, StationConfig>;
  sensors: SensorConfig[];
}

// ---- Sensor System ----

export type SensorType = 'data_check' | 'routing' | 'process_decision';
export type SensorDecision = 'pass' | 'fail' | 'rework' | 'skip_process';

export interface SensorConfig {
  sensorId: string;
  displayId: string;
  type: SensorType;
  fromStationId: string;
  toStationId: string;
  /** Position along the belt path 0.0 to 1.0 */
  positionOnBelt: number;
  /** Probability of negative outcome (0.0 to 1.0) */
  failProbability: number;
}

export interface SensorState {
  sensorId: string;
  lastTriggeredAt: string | null;
  lastDecision: SensorDecision | null;
  lastPartId: string | null;
  isActive: boolean;
}

export interface MqttSensorTrigger {
  sensorId: string;
  partId: string;
  type: SensorType;
  decision: SensorDecision;
  timestamp: string;
  fromStationId: string;
  toStationId: string;
}

export interface MqttTransitStart {
  partId: string;
  fromStationId: string;
  toStationId: string;
  transitTimeMs: number;
  timestamp: string;
}

export interface MqttTransitStop {
  partId: string;
  fromStationId: string;
  toStationId: string;
  reason: string;
  timestamp: string;
}

// ---- MQTT Payloads ----

export interface MqttPartEnter {
  partId: string;
  timestamp: string;
  stationId: string;
  area: string;
  line: string;
}

export interface MqttPartExit {
  partId: string;
  timestamp: string;
  stationId: string;
  area: string;
  line: string;
  result: ExitResult;
  cycleTimeMs: number;
}

export interface MqttPartProcess {
  partId: string;
  timestamp: string;
  stationId: string;
  progressPct: number;
}

export interface MqttStationStatus {
  stationId: string;
  status: StationStatus;
  timestamp: string;
  currentPartId: string | null;
}

export interface MqttMetric {
  stationId: string;
  value: number;
  unit: string;
  timestamp: string;
}

// ---- WebSocket Messages (Backend -> Frontend) ----

export type WsMessage =
  | { type: 'init'; data: { parts: Part[]; layout: FactoryLayout; stations: Record<string, StationState>; sensors: Record<string, SensorState> } }
  | { type: 'part_enter'; data: MqttPartEnter }
  | { type: 'part_exit'; data: MqttPartExit }
  | { type: 'part_process'; data: MqttPartProcess }
  | { type: 'station_status'; data: MqttStationStatus }
  | { type: 'metric_update'; data: { stationId: string; metric: string; value: number; unit: string } }
  | { type: 'part_created'; data: Part }
  | { type: 'transit_start'; data: MqttTransitStart }
  | { type: 'transit_stop'; data: MqttTransitStop }
  | { type: 'sensor_trigger'; data: MqttSensorTrigger }
  | { type: 'part_override'; data: { partId: string; timestamp: string } };

// ---- WebSocket Messages (Frontend -> Backend) ----

export type WsRequest =
  | { type: 'get_part_history'; partId: string }
  | { type: 'search_part'; query: string }
  | { type: 'override_part'; partId: string };

export type WsResponse =
  | { type: 'part_history'; data: Part | null }
  | { type: 'search_results'; data: Part[] };
