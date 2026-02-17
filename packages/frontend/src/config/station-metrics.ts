import type { StationMetricConfig, StationType } from '../types.ts';

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
