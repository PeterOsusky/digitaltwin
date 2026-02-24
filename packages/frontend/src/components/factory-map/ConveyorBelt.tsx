import type { StationConfig } from '../../types.ts';

interface Props {
  from: StationConfig;
  to: StationConfig;
}

const STATION_W = 120;

export function ConveyorBelt({ from, to }: Props) {
  // Belt connects right edge of "from" to left edge of "to"
  const x1 = from.position.x + STATION_W / 2;
  const y1 = from.position.y;
  const x2 = to.position.x - STATION_W / 2;
  const y2 = to.position.y;

  const beltId = `belt-${from.stationId}-${to.stationId}`;

  return (
    <g>
      {/* Belt background (darker line) */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#374151"
        strokeWidth={8}
        strokeLinecap="round"
      />

      {/* Belt track lines (rails) */}
      <line
        x1={x1}
        y1={y1 - 3}
        x2={x2}
        y2={y2 - 3}
        stroke="#4b5563"
        strokeWidth={1}
      />
      <line
        x1={x1}
        y1={y1 + 3}
        x2={x2}
        y2={y2 + 3}
        stroke="#4b5563"
        strokeWidth={1}
      />

      {/* Animated dashes (moving belt effect) */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#6b7280"
        strokeWidth={2}
        strokeDasharray="8 12"
        strokeLinecap="round"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to="-20"
          dur="1s"
          repeatCount="indefinite"
        />
      </line>

      {/* Arrow at the end */}
      <defs>
        <marker
          id={beltId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
        </marker>
      </defs>
      <line
        x1={x1 + 10}
        y1={y1}
        x2={x2 - 2}
        y2={y2}
        stroke="transparent"
        strokeWidth={1}
        markerEnd={`url(#${beltId})`}
      />
    </g>
  );
}
