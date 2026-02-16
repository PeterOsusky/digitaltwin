import type { StationConfig } from '../../types.ts';

interface Props {
  from: StationConfig;
  to: StationConfig;
  isRework?: boolean;
}

export function ConnectionLine({ from, to, isRework }: Props) {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Offset start/end to be at station edge (60px = half station width)
  const offsetX = (dx / len) * 60;
  const offsetY = (dy / len) * 30;

  const x1 = from.position.x + offsetX;
  const y1 = from.position.y + offsetY;
  const x2 = to.position.x - offsetX;
  const y2 = to.position.y - offsetY;

  // For rework lines, add a curve
  if (isRework) {
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 40;
    return (
      <g>
        <path
          d={`M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="6 3"
          markerEnd="url(#arrowRework)"
          opacity={0.6}
        />
      </g>
    );
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="#4b5563"
      strokeWidth={2}
      markerEnd="url(#arrowNormal)"
    />
  );
}
