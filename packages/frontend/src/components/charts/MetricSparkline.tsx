import { useId } from 'react';
import { AreaChart, Area, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import type { MetricSample, StationMetricConfig } from '../../types.ts';

interface Props {
  samples: MetricSample[];
  config: StationMetricConfig;
  width?: number;
  height?: number;
}

function getValueColor(value: number, config: StationMetricConfig): string {
  if (value >= config.nominalMin && value <= config.nominalMax) return '#22c55e'; // green
  if (value >= config.warningMin && value <= config.warningMax) return '#eab308'; // yellow
  return '#ef4444'; // red
}

export function MetricSparkline({ samples, config, width = 140, height = 44 }: Props) {
  const uid = useId();
  const gradientId = `grad-${config.metricId}-${uid.replace(/:/g, '')}`;

  if (samples.length === 0) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-600 text-[10px]">
        No data
      </div>
    );
  }

  const latestValue = samples[samples.length - 1].value;
  const fillColor = getValueColor(latestValue, config);

  const data = samples.map((s, i) => ({
    idx: i,
    value: s.value,
  }));

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={`${gradientId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fillColor} stopOpacity={0.4} />
              <stop offset="100%" stopColor={fillColor} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <YAxis
            domain={[config.warningMin - config.variance * 0.1, config.warningMax + config.variance * 0.1]}
            hide
          />
          <ReferenceLine y={config.nominalMin} stroke="#22c55e" strokeDasharray="2 2" strokeOpacity={0.3} />
          <ReferenceLine y={config.nominalMax} stroke="#22c55e" strokeDasharray="2 2" strokeOpacity={0.3} />
          <Area
            type="monotone"
            dataKey="value"
            stroke={fillColor}
            strokeWidth={1.5}
            fill={`url(#grad-${config.metricId})`}
            isAnimationActive={false}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const val = payload[0].value as number;
              return (
                <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-white shadow-lg">
                  {val.toFixed(2)} {config.unit}
                </div>
              );
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
