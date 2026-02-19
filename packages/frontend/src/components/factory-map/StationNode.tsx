import type { StationConfig, StationState } from '../../types.ts';
import { useStore } from '../../store/useStore.ts';
import { shortPartId } from '../../utils/format.ts';

const STATUS_COLORS: Record<string, string> = {
  running: '#22c55e',   // green
  idle: '#6b7280',      // gray
  error: '#ef4444',     // red
  offline: '#374151',   // dark gray
  online: '#6b7280',    // gray
};

const TYPE_ICONS: Record<string, string> = {
  load: '\u2B07',       // down arrow
  machine: '\u2699',    // gear
  inspection: '\u2714', // checkmark
  measure: '\uD83D\uDCCF', // ruler
  manual: '\u270B',     // hand
  pack: '\uD83D\uDCE6', // package
  buffer: '\u23F8',     // pause
};

interface Props {
  config: StationConfig;
  state: StationState | undefined;
}

export function StationNode({ config, state }: Props) {
  const status = state?.status ?? 'offline';
  const partId = state?.currentPartId;
  const isRunning = status === 'running';
  const progress = (() => {
    if (!partId) return 0;
    const parts = useStore.getState().parts;
    const part = parts.get(partId);
    return part?.progressPct ?? 0;
  })();

  const w = 44;
  const h = 20;
  const x = config.position.x - w / 2;
  const y = config.position.y - h / 2;

  return (
    <g>
      {/* Station body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        fill={STATUS_COLORS[status] ?? '#374151'}
        fillOpacity={0.3}
        stroke={STATUS_COLORS[status] ?? '#374151'}
        strokeWidth={1}
      />

      {/* Progress bar (inside station) */}
      {isRunning && progress > 0 && (
        <rect
          x={x + 1}
          y={y + h - 3}
          width={(w - 2) * (progress / 100)}
          height={2}
          rx={1}
          fill={STATUS_COLORS.running}
          opacity={0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Station displayId (centered) */}
      <text
        x={config.position.x}
        y={config.position.y + 1}
        fontSize={7}
        fill="white"
        fontWeight={700}
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ pointerEvents: 'none' }}
      >
        {TYPE_ICONS[config.type] ?? '\u2699'}{config.displayId}
      </text>

      {/* Part chip above station (read-only label) */}
      {partId && (
        <g>
          <rect
            x={config.position.x - 14}
            y={y - 11}
            width={28}
            height={10}
            rx={5}
            fill="#3b82f6"
          />
          <text
            x={config.position.x}
            y={y - 4.5}
            fontSize={6}
            fill="white"
            textAnchor="middle"
            fontWeight={600}
            style={{ pointerEvents: 'none' }}
          >
            {shortPartId(partId)}
          </text>
        </g>
      )}
    </g>
  );
}
