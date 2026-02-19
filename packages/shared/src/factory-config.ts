import type { FactoryLayout, StationConfig, AreaConfig, SensorConfig, StationMetricConfig, StationType } from './types.js';

// ---- Grid Layout Definition ----
// ViewBox: 1600x900, 2 columns x 5 rows of manufacturing areas
// Each area contains 2 production lines with 10 stations each = 200 stations total

interface AreaDef {
  prefix: string;
  name: string;
  areaId: string;
  col: 0 | 1;
  row: number;
  lineIds: [string, string];
}

const AREA_DEFS: AreaDef[] = [
  { prefix: 'aa', name: 'Assembly A', areaId: 'assembly-a', col: 0, row: 0, lineIds: ['line-aa1', 'line-aa2'] },
  { prefix: 'ab', name: 'Assembly B', areaId: 'assembly-b', col: 1, row: 0, lineIds: ['line-ab1', 'line-ab2'] },
  { prefix: 'wa', name: 'Welding A',  areaId: 'welding-a',  col: 0, row: 1, lineIds: ['line-wa1', 'line-wa2'] },
  { prefix: 'wb', name: 'Welding B',  areaId: 'welding-b',  col: 1, row: 1, lineIds: ['line-wb1', 'line-wb2'] },
  { prefix: 'ma', name: 'Machining A', areaId: 'machining-a', col: 0, row: 2, lineIds: ['line-ma1', 'line-ma2'] },
  { prefix: 'mb', name: 'Machining B', areaId: 'machining-b', col: 1, row: 2, lineIds: ['line-mb1', 'line-mb2'] },
  { prefix: 'pa', name: 'Painting A', areaId: 'painting-a', col: 0, row: 3, lineIds: ['line-pa1', 'line-pa2'] },
  { prefix: 'pb', name: 'Painting B', areaId: 'painting-b', col: 1, row: 3, lineIds: ['line-pb1', 'line-pb2'] },
  { prefix: 'ka', name: 'Packaging A', areaId: 'packaging-a', col: 0, row: 4, lineIds: ['line-ka1', 'line-ka2'] },
  { prefix: 'kb', name: 'Packaging B', areaId: 'packaging-b', col: 1, row: 4, lineIds: ['line-kb1', 'line-kb2'] },
];

// Station type pattern for every line (10 stations)
const LINE_PATTERN: StationType[] = [
  'load', 'machine', 'machine', 'buffer', 'measure',
  'machine', 'machine', 'measure', 'inspection', 'pack',
];

// Human-readable names per station type
const TYPE_NAMES: Record<StationType, string> = {
  load: 'Loading Dock',
  machine: 'CNC Machine',
  buffer: 'Buffer Zone',
  measure: 'Quality Check',
  inspection: 'Final Inspection',
  pack: 'Packing Station',
  manual: 'Manual Station',
};

// Processing time ranges [min, max] in ms per station type
const PROCESSING_TIMES: Record<StationType, [number, number]> = {
  load: [3000, 6000],
  machine: [8000, 20000],
  buffer: [2000, 4000],
  measure: [5000, 12000],
  inspection: [4000, 10000],
  pack: [3000, 8000],
  manual: [5000, 15000],
};

// Coordinate helpers
const COL_X_START = [60, 860] as const;   // left edge of station positions per column
const COL_X_END   = [740, 1540] as const; // right edge of station positions per column
const STATION_SPACING = (COL_X_END[0] - COL_X_START[0]) / 9; // ~75.56px

const ROW_Y_STARTS = [10, 185, 360, 535, 710]; // area top y per row
const LINE_Y_OFFSETS = [50, 120]; // relative y offset for line 1 and line 2 within area

function stationX(col: 0 | 1, index: number): number {
  return Math.round(COL_X_START[col] + index * ((COL_X_END[col] - COL_X_START[col]) / 9));
}

function stationY(row: number, lineIdx: number): number {
  return ROW_Y_STARTS[row] + LINE_Y_OFFSETS[lineIdx];
}

// Sensor type cycle and fail probabilities
const SENSOR_TYPE_CYCLE: Array<SensorConfig['type']> = ['data_check', 'routing', 'process_decision'];
const SENSOR_FAIL_PROB: Record<SensorConfig['type'], number> = {
  data_check: 0.03,
  routing: 0.06,
  process_decision: 0.10,
};

// ---- Programmatic Generation ----

const stations: Record<string, StationConfig> = {};
const areas: AreaConfig[] = [];
const sensors: SensorConfig[] = [];

let displayIdCounter = 1001;

for (const areaDef of AREA_DEFS) {
  const areaLines: AreaConfig['lines'] = [];

  for (let lineIdx = 0; lineIdx < 2; lineIdx++) {
    const lineId = areaDef.lineIds[lineIdx];
    const lineNum = lineIdx + 1;
    const stationIds: string[] = [];

    // Generate 10 stations for this line
    for (let sIdx = 0; sIdx < LINE_PATTERN.length; sIdx++) {
      const sType = LINE_PATTERN[sIdx];
      const stationNum = String(sIdx + 1).padStart(2, '0');
      const stationId = `${areaDef.prefix}-${sType}-${lineNum}-${stationNum}`;
      const displayId = String(displayIdCounter++);

      // nextStations: connect to the next station in line (last station has none)
      const nextStations: string[] = [];
      if (sIdx < LINE_PATTERN.length - 1) {
        const nextType = LINE_PATTERN[sIdx + 1];
        const nextNum = String(sIdx + 2).padStart(2, '0');
        nextStations.push(`${areaDef.prefix}-${nextType}-${lineNum}-${nextNum}`);
      }

      // reworkTarget: measure stations point to the previous machine station
      let reworkTarget: string | undefined;
      if (sType === 'measure') {
        // Walk backwards to find the nearest machine station
        for (let k = sIdx - 1; k >= 0; k--) {
          if (LINE_PATTERN[k] === 'machine') {
            const rNum = String(k + 1).padStart(2, '0');
            reworkTarget = `${areaDef.prefix}-machine-${lineNum}-${rNum}`;
            break;
          }
        }
      }

      const config: StationConfig = {
        stationId,
        displayId,
        name: `${TYPE_NAMES[sType]} ${areaDef.prefix.toUpperCase()}-${lineNum}-${stationNum}`,
        area: areaDef.areaId,
        line: lineId,
        type: sType,
        position: {
          x: stationX(areaDef.col, sIdx),
          y: stationY(areaDef.row, lineIdx),
        },
        nextStations,
        processingTime: PROCESSING_TIMES[sType],
        ...(reworkTarget ? { reworkTarget } : {}),
      };

      stations[stationId] = config;
      stationIds.push(stationId);
    }

    // Generate 9 sensors for this line (one per belt segment between consecutive stations)
    for (let sIdx = 0; sIdx < stationIds.length - 1; sIdx++) {
      const fromId = stationIds[sIdx];
      const toId = stationIds[sIdx + 1];
      const sensorType = SENSOR_TYPE_CYCLE[sIdx % SENSOR_TYPE_CYCLE.length];
      const fromDisplayId = stations[fromId].displayId;
      const position = sIdx + 1; // 1-based position in line

      sensors.push({
        sensorId: `snsr-${areaDef.prefix}-${lineNum}-${String(position).padStart(2, '0')}`,
        displayId: `S-${fromDisplayId}-A`,
        type: sensorType,
        fromStationId: fromId,
        toStationId: toId,
        positionOnBelt: 0.5,
        failProbability: SENSOR_FAIL_PROB[sensorType],
      });
    }

    areaLines.push({
      lineId,
      area: areaDef.areaId,
      name: `${areaDef.name} Line ${lineNum}`,
      stations: stationIds,
    });
  }

  areas.push({
    areaId: areaDef.areaId,
    name: areaDef.name,
    lines: areaLines,
  });
}

// ---- Station Metric Configs per type ----
// Each station type publishes specific metrics with realistic thresholds

export const STATION_METRIC_CONFIGS: Record<StationType, StationMetricConfig[]> = {
  load: [
    { metricId: 'weight', label: 'Load Weight', unit: 'kg', nominalMin: 4.5, nominalMax: 5.5, warningMin: 4.0, warningMax: 6.0, baseValue: 5.0, variance: 0.8 },
  ],
  machine: [
    { metricId: 'vibration', label: 'Vibration', unit: 'mm/s', nominalMin: 0, nominalMax: 4.0, warningMin: 0, warningMax: 6.0, baseValue: 2.5, variance: 2.0 },
    { metricId: 'power', label: 'Power Draw', unit: 'kW', nominalMin: 5.0, nominalMax: 15.0, warningMin: 3.0, warningMax: 18.0, baseValue: 10.0, variance: 5.0 },
    { metricId: 'temperature', label: 'Temperature', unit: '\u00B0C', nominalMin: 50, nominalMax: 75, warningMin: 40, warningMax: 85, baseValue: 62, variance: 12 },
  ],
  measure: [
    { metricId: 'dimension', label: 'Dimension', unit: 'mm', nominalMin: 99.8, nominalMax: 100.2, warningMin: 99.5, warningMax: 100.5, baseValue: 100.0, variance: 0.4 },
    { metricId: 'accuracy', label: 'Accuracy', unit: '%', nominalMin: 98.0, nominalMax: 100.0, warningMin: 95.0, warningMax: 100.0, baseValue: 99.2, variance: 2.0 },
  ],
  inspection: [
    { metricId: 'score', label: 'Quality Score', unit: 'pts', nominalMin: 85, nominalMax: 100, warningMin: 70, warningMax: 100, baseValue: 92, variance: 10 },
    { metricId: 'defects', label: 'Defect Count', unit: 'pcs', nominalMin: 0, nominalMax: 2, warningMin: 0, warningMax: 5, baseValue: 1, variance: 2 },
  ],
  manual: [
    { metricId: 'temperature', label: 'Temperature', unit: '\u00B0C', nominalMin: 18, nominalMax: 26, warningMin: 15, warningMax: 30, baseValue: 22, variance: 4 },
  ],
  pack: [
    { metricId: 'weight', label: 'Package Weight', unit: 'kg', nominalMin: 9.5, nominalMax: 10.5, warningMin: 9.0, warningMax: 11.0, baseValue: 10.0, variance: 0.7 },
  ],
  buffer: [],
};

export const SENSOR_CONFIG = sensors;
export const FACTORY_LAYOUT: FactoryLayout = { areas, stations, sensors };

/** Get all line IDs with their ordered station sequences for simulation routing */
export function getLineRoutes(): Array<{ lineId: string; area: string; stations: string[] }> {
  return areas.flatMap(a => a.lines.map(l => ({
    lineId: l.lineId,
    area: l.area,
    stations: l.stations,
  })));
}
