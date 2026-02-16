import { useEffect, useRef, useState } from 'react';
import type { SensorConfig, SensorState, SensorDecision } from '../../types.ts';

const TYPE_COLORS: Record<string, string> = {
  data_check: '#3b82f6',    // blue
  routing: '#f59e0b',       // amber
  process_decision: '#8b5cf6', // purple
};

const TYPE_LABELS: Record<string, string> = {
  data_check: 'DC',
  routing: 'RT',
  process_decision: 'PD',
};

const DECISION_LABELS: Record<SensorDecision, string> = {
  pass: 'OK',
  fail: 'FAIL',
  rework: 'REWORK',
  skip_process: 'SKIP',
};

const DECISION_COLORS: Record<SensorDecision, string> = {
  pass: '#22c55e',
  fail: '#ef4444',
  rework: '#f59e0b',
  skip_process: '#8b5cf6',
};

interface Props {
  config: SensorConfig;
  state: SensorState | undefined;
  beltPathId: string;
  isSelected?: boolean;
  onClick?: () => void;
}

export function SensorNode({ config, state, beltPathId, isSelected, onClick }: Props) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [showDecision, setShowDecision] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const prevDecisionRef = useRef<string | null>(null);

  // Compute position from SVG path element
  useEffect(() => {
    const pathEl = document.getElementById(beltPathId) as SVGPathElement | null;
    if (!pathEl) return;

    const totalLength = pathEl.getTotalLength();
    const point = pathEl.getPointAtLength(totalLength * config.positionOnBelt);
    setPosition({ x: point.x, y: point.y });
  }, [beltPathId, config.positionOnBelt]);

  // Flash animation when decision changes
  useEffect(() => {
    const currentDecision = state?.lastDecision ?? null;
    const currentTriggeredAt = state?.lastTriggeredAt ?? null;

    if (currentDecision && currentTriggeredAt !== prevDecisionRef.current) {
      prevDecisionRef.current = currentTriggeredAt;
      setFlashKey(k => k + 1);
      setShowDecision(true);

      const timer = setTimeout(() => {
        setShowDecision(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [state?.lastDecision, state?.lastTriggeredAt]);

  if (!position) return null;

  const color = TYPE_COLORS[config.type] ?? '#6b7280';
  const label = TYPE_LABELS[config.type] ?? '?';
  const size = 6;

  // Diamond points
  const diamondPoints = [
    `${position.x},${position.y - size}`,
    `${position.x + size},${position.y}`,
    `${position.x},${position.y + size}`,
    `${position.x - size},${position.y}`,
  ].join(' ');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  };

  return (
    <g onClick={handleClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {/* Selection ring */}
      {isSelected && (
        <circle
          cx={position.x}
          cy={position.y}
          r={12}
          fill="none"
          stroke="#a78bfa"
          strokeWidth={2}
          opacity={0.8}
          filter="url(#glow)"
        />
      )}

      {/* Invisible hit area for easier clicking */}
      <circle
        cx={position.x}
        cy={position.y}
        r={10}
        fill="transparent"
      />

      {/* Flash circle on trigger */}
      {showDecision && (
        <circle
          key={`flash-${flashKey}`}
          cx={position.x}
          cy={position.y}
          r={6}
          fill={state?.lastDecision ? DECISION_COLORS[state.lastDecision] : color}
          opacity={0.6}
          className="sensor-flash"
        />
      )}

      {/* Diamond shape */}
      <polygon
        points={diamondPoints}
        fill={color}
        stroke={isSelected ? '#a78bfa' : '#111827'}
        strokeWidth={isSelected ? 2 : 1}
        opacity={state?.isActive ? 1 : 0.6}
      />

      {/* Display ID below */}
      <text
        x={position.x}
        y={position.y + size + 10}
        fontSize={6}
        fill="#9ca3af"
        textAnchor="middle"
        fontWeight={600}
      >
        {config.displayId}
      </text>

      {/* Decision label (fades after 2s) */}
      {state?.lastDecision && (
        <text
          x={position.x}
          y={position.y - size - 4}
          fontSize={8}
          fill={DECISION_COLORS[state.lastDecision]}
          textAnchor="middle"
          fontWeight={700}
          style={{
            opacity: showDecision ? 1 : 0,
            transition: 'opacity 0.5s ease-out',
          }}
        >
          {DECISION_LABELS[state.lastDecision]}
        </text>
      )}
    </g>
  );
}
