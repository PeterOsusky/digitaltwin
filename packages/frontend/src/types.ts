// ---- Metric Types ----

export interface MetricSample {
  value: number;
  timestamp: string;
}

export interface StationMetricConfig {
  metricId: string;
  label: string;
  unit: string;
  nominalMin: number;
  nominalMax: number;
  warningMin: number;
  warningMax: number;
  baseValue: number;
  variance: number;
}

export interface StationCounters {
  ok: number;
  nok: number;
  rework: number;
}

// ---- Core Types ----

export type PartStatus = 'in_station' | 'in_transit' | 'completed' | 'scrapped';
export type StationStatus = 'online' | 'offline' | 'error' | 'idle' | 'running';
export type ExitResult = 'ok' | 'nok' | 'rework';
export type StationType = 'load' | 'machine' | 'inspection' | 'measure' | 'buffer' | 'manual' | 'pack';

export type SensorType = 'data_check' | 'routing' | 'process_decision';
export type SensorDecision = 'pass' | 'fail' | 'rework' | 'skip_process';

export interface PartSensorEvent {
  sensorId: string; type: SensorType; decision: SensorDecision;
  timestamp: string; fromStationId: string; toStationId: string;
}

export interface PartHistoryEntry {
  stationId: string; area: string; line: string;
  enteredAt: string; exitedAt: string | null;
  result: ExitResult | null; cycleTimeMs: number | null; progressPct: number;
}

export interface Part {
  partId: string; createdAt: string; status: PartStatus;
  currentStation: string | null; currentArea: string | null; currentLine: string | null;
  history: PartHistoryEntry[];
  sensorEvents: PartSensorEvent[];
}

export interface StationPosition { x: number; y: number; }

export interface StationConfig {
  stationId: string; displayId: string; name: string; area: string; line: string;
  type: StationType; position: StationPosition;
  nextStations: string[]; reworkTarget?: string;
  processingTime: [number, number];
}

export interface StationState {
  stationId: string; status: StationStatus; currentPartId: string | null;
  metrics: { temperature?: number; cycleTime?: number; outputCount?: number; };
  metricHistory?: Record<string, MetricSample[]>;
  counters?: StationCounters;
}

export interface SensorConfig {
  sensorId: string; displayId: string; type: SensorType;
  fromStationId: string; toStationId: string;
  positionOnBelt: number; failProbability: number;
}

export interface SensorState {
  sensorId: string; lastTriggeredAt: string | null;
  lastDecision: SensorDecision | null; lastPartId: string | null; isActive: boolean;
}

export interface LineConfig { lineId: string; area: string; name: string; stations: string[]; }
export interface AreaConfig { areaId: string; name: string; lines: LineConfig[]; }

export interface FactoryLayout {
  areas: AreaConfig[];
  stations: Record<string, StationConfig>;
  sensors: SensorConfig[];
}

export interface TransitPart {
  partId: string; fromStationId: string; toStationId: string;
  startedAt: number; transitTimeMs: number; stopped: boolean;
}

export interface LiveEvent {
  id: string;
  type: 'part_enter' | 'part_exit' | 'station_status' | 'error' | 'sensor';
  message: string; timestamp: string;
  partId?: string; stationId?: string; result?: ExitResult;
}

export type WsMessage =
  | { type: 'init'; data: { parts: Part[]; layout: FactoryLayout; stations: Record<string, StationState>; sensors: Record<string, SensorState> } }
  | { type: 'part_enter'; data: { partId: string; timestamp: string; stationId: string; area: string; line: string } }
  | { type: 'part_exit'; data: { partId: string; timestamp: string; stationId: string; area: string; line: string; result: ExitResult; cycleTimeMs: number } }
  | { type: 'part_process'; data: { partId: string; timestamp: string; stationId: string; progressPct: number } }
  | { type: 'station_status'; data: { stationId: string; status: StationStatus; timestamp: string; currentPartId: string | null } }
  | { type: 'metric_update'; data: { stationId: string; metric: string; value: number; unit: string } }
  | { type: 'part_created'; data: Part }
  | { type: 'transit_start'; data: { partId: string; fromStationId: string; toStationId: string; transitTimeMs: number; timestamp: string } }
  | { type: 'transit_stop'; data: { partId: string; fromStationId: string; toStationId: string; reason: string; timestamp: string } }
  | { type: 'sensor_trigger'; data: { sensorId: string; partId: string; type: SensorType; decision: SensorDecision; timestamp: string; fromStationId: string; toStationId: string } }
  | { type: 'part_override'; data: { partId: string; timestamp: string } };
