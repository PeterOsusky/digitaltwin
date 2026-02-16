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
  const selectPart = useStore(s => s.selectPart);
  const selectStation = useStore(s => s.selectStation);
  const selectedPartId = useStore(s => s.selectedPartId);
  const selectedStationId = useStore(s => s.selectedStationId);

  const status = state?.status ?? 'offline';
  const partId = state?.currentPartId;
  const isRunning = status === 'running';
  const isStationSelected = config.stationId === selectedStationId;
  const isPartSelected = partId && partId === selectedPartId;
  const progress = (() => {
    if (!partId) return 0;
    const parts = useStore.getState().parts;
    const part = parts.get(partId);
    if (!part) return 0;
    const last = part.history[part.history.length - 1];
    return last?.progressPct ?? 0;
  })();

  const w = 80;
  const h = 36;
  const x = config.position.x - w / 2;
  const y = config.position.y - h / 2;

  const handleStationClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectStation(isStationSelected ? null : config.stationId);
    selectPart(null);
  };

  const handlePartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (partId) {
      selectPart(partId);
      selectStation(null);
    }
  };

  return (
    <g>
      {/* Glow effect for selected station */}
      {isStationSelected && (
        <rect
          x={x - 3}
          y={y - 3}
          width={w + 6}
          height={h + 6}
          rx={10}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.5}
          opacity={0.4}
          className="station-glow"
        />
      )}

      {/* Station body */}
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={6}
        fill={STATUS_COLORS[status] ?? '#374151'}
        fillOpacity={0.3}
        stroke={isStationSelected ? '#ffffff' : (STATUS_COLORS[status] ?? '#374151')}
        strokeWidth={isStationSelected ? 2.5 : 1.5}
        style={{ cursor: 'pointer' }}
        onClick={handleStationClick}
      />

      {/* Progress bar (inside station) */}
      {isRunning && progress > 0 && (
        <rect
          x={x + 2}
          y={y + h - 5}
          width={(w - 4) * (progress / 100)}
          height={3}
          rx={1.5}
          fill={STATUS_COLORS.running}
          opacity={0.8}
          style={{ pointerEvents: 'none' }}
        />
      )}

      {/* Station icon + displayId (top line) */}
      <text
        x={config.position.x}
        y={config.position.y - 4}
        fontSize={11}
        fill="white"
        fontWeight={700}
        textAnchor="middle"
        style={{ pointerEvents: 'none' }}
      >
        {TYPE_ICONS[config.type] ?? '\u2699'} {config.displayId}
      </text>

      {/* Station name (bottom line, smaller) */}
      <text
        x={config.position.x}
        y={config.position.y + 10}
        fontSize={7}
        fill="#9ca3af"
        textAnchor="middle"
        style={{ pointerEvents: 'none' }}
      >
        {config.name}
      </text>

      {/* Part chip above station */}
      {partId && (
        <g
          style={{ cursor: 'pointer' }}
          onClick={handlePartClick}
        >
          <rect
            x={config.position.x - 22}
            y={y - 17}
            width={44}
            height={14}
            rx={7}
            fill="#3b82f6"
            stroke={isPartSelected ? '#fff' : 'none'}
            strokeWidth={1.5}
          />
          <text
            x={config.position.x}
            y={y - 7.5}
            fontSize={8}
            fill="white"
            textAnchor="middle"
            fontWeight={600}
          >
            {shortPartId(partId)}
          </text>
        </g>
      )}
    </g>
  );
}
