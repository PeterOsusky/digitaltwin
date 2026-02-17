import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import type { StationCounters } from '../../types.ts';

interface Props {
  counters: StationCounters;
  size?: number;
}

const COLORS = {
  ok: '#22c55e',
  nok: '#ef4444',
  rework: '#eab308',
};

export function OkNokPieChart({ counters, size = 100 }: Props) {
  const total = counters.ok + counters.nok + counters.rework;

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center text-gray-600 text-[10px]"
      >
        No data
      </div>
    );
  }

  const data = [
    { name: 'OK', value: counters.ok, color: COLORS.ok },
    { name: 'NOK', value: counters.nok, color: COLORS.nok },
    { name: 'Rework', value: counters.rework, color: COLORS.rework },
  ].filter(d => d.value > 0);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Pie
          data={data}
          cx={size / 2 - 1}
          cy={size / 2 - 1}
          innerRadius={size * 0.28}
          outerRadius={size * 0.44}
          dataKey="value"
          strokeWidth={1}
          stroke="#1f2937"
          isAnimationActive={false}
        >
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.[0]) return null;
            const d = payload[0].payload as { name: string; value: number; color: string };
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0';
            return (
              <div className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-[10px] text-white shadow-lg">
                <span style={{ color: d.color }} className="font-bold">{d.name}</span>: {d.value} ({pct}%)
              </div>
            );
          }}
        />
      </PieChart>
      {/* Center label */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
      >
        <span className="text-white font-bold text-sm leading-none">{total}</span>
        <span className="text-gray-500 text-[8px] leading-none">total</span>
      </div>
    </div>
  );
}
