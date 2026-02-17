import type { FactoryLayout, StationConfig, AreaConfig, SensorConfig, StationMetricConfig, StationType } from './types.js';

// Station definitions with floor plan positions
// Coordinate system: x=0-1000, y=0-600 (SVG viewBox)

const stations: Record<string, StationConfig> = {
  // ---- Assembly Line (top area, y: 50-150) ----
  'asm-load-01': {
    stationId: 'asm-load-01', displayId: '1001', name: 'Loading Dock', area: 'assembly', line: 'line1',
    type: 'load', position: { x: 80, y: 100 }, nextStations: ['asm-press-01'],
    processingTime: [5000, 10000],
  },
  'asm-press-01': {
    stationId: 'asm-press-01', displayId: '1002', name: 'Hydraulic Press', area: 'assembly', line: 'line1',
    type: 'machine', position: { x: 250, y: 100 }, nextStations: ['asm-drill-01'],
    processingTime: [15000, 30000],
  },
  'asm-drill-01': {
    stationId: 'asm-drill-01', displayId: '1003', name: 'CNC Drill', area: 'assembly', line: 'line1',
    type: 'machine', position: { x: 420, y: 100 }, nextStations: ['asm-measure-01'],
    processingTime: [20000, 40000],
  },
  'asm-measure-01': {
    stationId: 'asm-measure-01', displayId: '1004', name: 'Quality Check', area: 'assembly', line: 'line1',
    type: 'measure', position: { x: 590, y: 100 }, nextStations: ['asm-inspect-01'],
    reworkTarget: 'asm-drill-01',
    processingTime: [10000, 20000],
  },
  'asm-inspect-01': {
    stationId: 'asm-inspect-01', displayId: '1005', name: 'Final Inspection', area: 'assembly', line: 'line1',
    type: 'inspection', position: { x: 760, y: 100 }, nextStations: [],
    processingTime: [8000, 15000],
  },

  // ---- Welding Line (middle area, y: 230-370) ----
  'wld-load-01': {
    stationId: 'wld-load-01', displayId: '2001', name: 'Material Feed', area: 'welding', line: 'line2',
    type: 'load', position: { x: 80, y: 280 }, nextStations: ['wld-weld-01', 'wld-weld-02'],
    processingTime: [5000, 10000],
  },
  'wld-weld-01': {
    stationId: 'wld-weld-01', displayId: '2002', name: 'Welder A', area: 'welding', line: 'line2',
    type: 'machine', position: { x: 250, y: 240 }, nextStations: ['wld-grind-01'],
    processingTime: [25000, 45000],
  },
  'wld-weld-02': {
    stationId: 'wld-weld-02', displayId: '2003', name: 'Welder B', area: 'welding', line: 'line2',
    type: 'machine', position: { x: 250, y: 330 }, nextStations: ['wld-grind-01'],
    processingTime: [25000, 45000],
  },
  'wld-grind-01': {
    stationId: 'wld-grind-01', displayId: '2004', name: 'Grinder', area: 'welding', line: 'line2',
    type: 'machine', position: { x: 420, y: 280 }, nextStations: ['wld-measure-01'],
    processingTime: [15000, 30000],
  },
  'wld-measure-01': {
    stationId: 'wld-measure-01', displayId: '2005', name: 'Weld QC', area: 'welding', line: 'line2',
    type: 'measure', position: { x: 590, y: 280 }, nextStations: ['wld-inspect-01'],
    reworkTarget: 'wld-grind-01',
    processingTime: [10000, 20000],
  },
  'wld-inspect-01': {
    stationId: 'wld-inspect-01', displayId: '2006', name: 'Weld Inspection', area: 'welding', line: 'line2',
    type: 'inspection', position: { x: 760, y: 280 }, nextStations: [],
    processingTime: [8000, 15000],
  },

  // ---- Painting Line (bottom area, y: 420-530) ----
  'pnt-prep-01': {
    stationId: 'pnt-prep-01', displayId: '3001', name: 'Surface Prep', area: 'painting', line: 'line3',
    type: 'manual', position: { x: 80, y: 470 }, nextStations: ['pnt-paint-01'],
    processingTime: [10000, 20000],
  },
  'pnt-paint-01': {
    stationId: 'pnt-paint-01', displayId: '3002', name: 'Paint Booth', area: 'painting', line: 'line3',
    type: 'machine', position: { x: 250, y: 470 }, nextStations: ['pnt-cure-01'],
    processingTime: [20000, 40000],
  },
  'pnt-cure-01': {
    stationId: 'pnt-cure-01', displayId: '3003', name: 'Curing Oven', area: 'painting', line: 'line3',
    type: 'machine', position: { x: 420, y: 470 }, nextStations: ['pnt-measure-01'],
    processingTime: [30000, 50000],
  },
  'pnt-measure-01': {
    stationId: 'pnt-measure-01', displayId: '3004', name: 'Paint QC', area: 'painting', line: 'line3',
    type: 'measure', position: { x: 590, y: 470 }, nextStations: ['pnt-pack-01'],
    reworkTarget: 'pnt-paint-01',
    processingTime: [10000, 20000],
  },
  'pnt-pack-01': {
    stationId: 'pnt-pack-01', displayId: '3005', name: 'Packing', area: 'painting', line: 'line3',
    type: 'pack', position: { x: 760, y: 470 }, nextStations: [],
    processingTime: [8000, 15000],
  },
};

const areas: AreaConfig[] = [
  {
    areaId: 'assembly',
    name: 'Assembly',
    lines: [{
      lineId: 'line1', area: 'assembly', name: 'Assembly Line 1',
      stations: ['asm-load-01', 'asm-press-01', 'asm-drill-01', 'asm-measure-01', 'asm-inspect-01'],
    }],
  },
  {
    areaId: 'welding',
    name: 'Welding',
    lines: [{
      lineId: 'line2', area: 'welding', name: 'Welding Line 2',
      stations: ['wld-load-01', 'wld-weld-01', 'wld-weld-02', 'wld-grind-01', 'wld-measure-01', 'wld-inspect-01'],
    }],
  },
  {
    areaId: 'painting',
    name: 'Painting',
    lines: [{
      lineId: 'line3', area: 'painting', name: 'Painting Line 3',
      stations: ['pnt-prep-01', 'pnt-paint-01', 'pnt-cure-01', 'pnt-measure-01', 'pnt-pack-01'],
    }],
  },
];

// ---- Sensor Configuration ----
// 2-3 sensors per conveyor belt segment
// displayId format: S-{upstream_station_displayId}-{A|B|C}

const sensors: SensorConfig[] = [
  // Assembly: Load -> Press
  { sensorId: 'snsr-asm-dc-01', displayId: 'S-1001-A', type: 'data_check', fromStationId: 'asm-load-01', toStationId: 'asm-press-01', positionOnBelt: 0.35, failProbability: 0.05 },
  { sensorId: 'snsr-asm-rt-01', displayId: 'S-1001-B', type: 'routing', fromStationId: 'asm-load-01', toStationId: 'asm-press-01', positionOnBelt: 0.7, failProbability: 0.08 },

  // Assembly: Press -> Drill
  { sensorId: 'snsr-asm-dc-02', displayId: 'S-1002-A', type: 'data_check', fromStationId: 'asm-press-01', toStationId: 'asm-drill-01', positionOnBelt: 0.3, failProbability: 0.04 },
  { sensorId: 'snsr-asm-pd-01', displayId: 'S-1002-B', type: 'process_decision', fromStationId: 'asm-press-01', toStationId: 'asm-drill-01', positionOnBelt: 0.65, failProbability: 0.10 },

  // Assembly: Drill -> Measure
  { sensorId: 'snsr-asm-dc-03', displayId: 'S-1003-A', type: 'data_check', fromStationId: 'asm-drill-01', toStationId: 'asm-measure-01', positionOnBelt: 0.4, failProbability: 0.03 },
  { sensorId: 'snsr-asm-rt-02', displayId: 'S-1003-B', type: 'routing', fromStationId: 'asm-drill-01', toStationId: 'asm-measure-01', positionOnBelt: 0.75, failProbability: 0.06 },

  // Assembly: Measure -> Inspect
  { sensorId: 'snsr-asm-dc-04', displayId: 'S-1004-A', type: 'data_check', fromStationId: 'asm-measure-01', toStationId: 'asm-inspect-01', positionOnBelt: 0.5, failProbability: 0.02 },

  // Welding: Load -> Weld A
  { sensorId: 'snsr-wld-dc-01', displayId: 'S-2001-A', type: 'data_check', fromStationId: 'wld-load-01', toStationId: 'wld-weld-01', positionOnBelt: 0.4, failProbability: 0.05 },
  { sensorId: 'snsr-wld-rt-01', displayId: 'S-2001-B', type: 'routing', fromStationId: 'wld-load-01', toStationId: 'wld-weld-01', positionOnBelt: 0.75, failProbability: 0.07 },

  // Welding: Load -> Weld B
  { sensorId: 'snsr-wld-dc-02', displayId: 'S-2001-C', type: 'data_check', fromStationId: 'wld-load-01', toStationId: 'wld-weld-02', positionOnBelt: 0.4, failProbability: 0.05 },

  // Welding: Weld A -> Grinder
  { sensorId: 'snsr-wld-dc-03', displayId: 'S-2002-A', type: 'data_check', fromStationId: 'wld-weld-01', toStationId: 'wld-grind-01', positionOnBelt: 0.35, failProbability: 0.04 },
  { sensorId: 'snsr-wld-pd-01', displayId: 'S-2002-B', type: 'process_decision', fromStationId: 'wld-weld-01', toStationId: 'wld-grind-01', positionOnBelt: 0.7, failProbability: 0.08 },

  // Welding: Weld B -> Grinder
  { sensorId: 'snsr-wld-dc-04', displayId: 'S-2003-A', type: 'data_check', fromStationId: 'wld-weld-02', toStationId: 'wld-grind-01', positionOnBelt: 0.5, failProbability: 0.04 },

  // Welding: Grinder -> Weld QC
  { sensorId: 'snsr-wld-dc-05', displayId: 'S-2004-A', type: 'data_check', fromStationId: 'wld-grind-01', toStationId: 'wld-measure-01', positionOnBelt: 0.3, failProbability: 0.03 },
  { sensorId: 'snsr-wld-rt-02', displayId: 'S-2004-B', type: 'routing', fromStationId: 'wld-grind-01', toStationId: 'wld-measure-01', positionOnBelt: 0.7, failProbability: 0.05 },

  // Welding: Weld QC -> Inspection
  { sensorId: 'snsr-wld-dc-06', displayId: 'S-2005-A', type: 'data_check', fromStationId: 'wld-measure-01', toStationId: 'wld-inspect-01', positionOnBelt: 0.5, failProbability: 0.02 },

  // Painting: Prep -> Paint
  { sensorId: 'snsr-pnt-dc-01', displayId: 'S-3001-A', type: 'data_check', fromStationId: 'pnt-prep-01', toStationId: 'pnt-paint-01', positionOnBelt: 0.35, failProbability: 0.04 },
  { sensorId: 'snsr-pnt-pd-01', displayId: 'S-3001-B', type: 'process_decision', fromStationId: 'pnt-prep-01', toStationId: 'pnt-paint-01', positionOnBelt: 0.7, failProbability: 0.12 },

  // Painting: Paint -> Cure
  { sensorId: 'snsr-pnt-dc-02', displayId: 'S-3002-A', type: 'data_check', fromStationId: 'pnt-paint-01', toStationId: 'pnt-cure-01', positionOnBelt: 0.3, failProbability: 0.03 },
  { sensorId: 'snsr-pnt-rt-01', displayId: 'S-3002-B', type: 'routing', fromStationId: 'pnt-paint-01', toStationId: 'pnt-cure-01', positionOnBelt: 0.65, failProbability: 0.06 },

  // Painting: Cure -> Paint QC
  { sensorId: 'snsr-pnt-dc-03', displayId: 'S-3003-A', type: 'data_check', fromStationId: 'pnt-cure-01', toStationId: 'pnt-measure-01', positionOnBelt: 0.4, failProbability: 0.03 },

  // Painting: Paint QC -> Pack
  { sensorId: 'snsr-pnt-dc-04', displayId: 'S-3004-A', type: 'data_check', fromStationId: 'pnt-measure-01', toStationId: 'pnt-pack-01', positionOnBelt: 0.5, failProbability: 0.02 },
];

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
