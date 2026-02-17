import { MetricSparkline } from './MetricSparkline.tsx';
import type { MetricSample, StationMetricConfig } from '../../types.ts';

interface Props {
  configs: StationMetricConfig[];
  metricHistory: Record<string, MetricSample[]>;
}

function getStatusDot(value: number | undefined, config: StationMetricConfig): { color: string; label: string } {
  if (value == null) return { color: 'bg-gray-600', label: '-' };
  if (value >= config.nominalMin && value <= config.nominalMax) return { color: 'bg-green-500', label: 'OK' };
  if (value >= config.warningMin && value <= config.warningMax) return { color: 'bg-yellow-500', label: 'WARN' };
  return { color: 'bg-red-500', label: 'CRIT' };
}

export function StationHealthIndicator({ configs, metricHistory }: Props) {
  if (configs.length === 0) {
    return <p className="text-gray-500 text-xs">No metrics configured</p>;
  }

  return (
    <div className="space-y-2">
      {configs.map(cfg => {
        const samples = metricHistory[cfg.metricId] ?? [];
        const latestValue = samples.length > 0 ? samples[samples.length - 1].value : undefined;
        const status = getStatusDot(latestValue, cfg);

        return (
          <div key={cfg.metricId} className="bg-gray-700/40 rounded p-2">
            {/* Header row: label + value + status dot */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-gray-300 font-medium">{cfg.label}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-white font-bold">
                  {latestValue != null ? `${latestValue.toFixed(1)} ${cfg.unit}` : '-'}
                </span>
                <div className={`w-2 h-2 rounded-full ${status.color}`} title={status.label} />
              </div>
            </div>
            {/* Sparkline */}
            <MetricSparkline samples={samples} config={cfg} width={320} height={36} />
            {/* Range labels */}
            <div className="flex justify-between text-[9px] text-gray-500 mt-0.5 px-0.5">
              <span>{cfg.warningMin} {cfg.unit}</span>
              <span className="text-green-700">
                {cfg.nominalMin}–{cfg.nominalMax}
              </span>
              <span>{cfg.warningMax} {cfg.unit}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
