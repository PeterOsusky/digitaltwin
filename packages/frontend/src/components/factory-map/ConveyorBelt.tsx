import type { StationConfig } from '../../types.ts';

interface Props {
  id: string;
  from: StationConfig;
  to: StationConfig;
  isRework: boolean;
}

export function ConveyorBelt({ id, from, to, isRework }: Props) {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  // Offset start/end to be at station edge (40px = half station width, 18px = half height)
  const offsetX = (dx / len) * 40;
  const offsetY = (dy / len) * 18;

  const x1 = from.position.x + offsetX;
  const y1 = from.position.y + offsetY;
  const x2 = to.position.x - offsetX;
  const y2 = to.position.y - offsetY;

  const beltPathId = `belt-${from.stationId}__${to.stationId}`;

  if (isRework) {
    // Quadratic bezier going above
    const midX = (x1 + x2) / 2;
    const midY = Math.min(y1, y2) - 60;
    const pathD = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

    return (
      <g>
        {/* Belt background */}
        <path
          d={pathD}
          fill="none"
          stroke="#92400e"
          strokeWidth={6}
          opacity={0.3}
          strokeLinecap="round"
        />
        {/* Animated dashes */}
        <path
          d={pathD}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={0.7}
          className="conveyor-animate"
          markerEnd="url(#arrowConveyorRework)"
        />
        {/* Hidden path for transit animation */}
        <path
          id={beltPathId}
          d={pathD}
          fill="none"
          stroke="none"
        />
      </g>
    );
  }

  const pathD = `M ${x1} ${y1} L ${x2} ${y2}`;

  return (
    <g>
      {/* Belt background (thick) */}
      <path
        d={pathD}
        fill="none"
        stroke="#1f2937"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Belt edges */}
      <path
        d={pathD}
        fill="none"
        stroke="#374151"
        strokeWidth={10}
        strokeLinecap="round"
        opacity={0.5}
      />
      {/* Animated dashes overlay */}
      <path
        d={pathD}
        fill="none"
        stroke="#6b7280"
        strokeWidth={2}
        strokeDasharray="8 12"
        className="conveyor-animate"
        markerEnd="url(#arrowConveyor)"
      />
      {/* Hidden path for transit animation */}
      <path
        id={beltPathId}
        d={pathD}
        fill="none"
        stroke="none"
      />
    </g>
  );
}
