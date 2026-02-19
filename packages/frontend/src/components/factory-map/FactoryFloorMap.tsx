import { useStore } from '../../store/useStore.ts';
import { StationNode } from './StationNode.tsx';
import { ConveyorBelt } from './ConveyorBelt.tsx';
import { SensorNode } from './SensorNode.tsx';
import { TransitPartChip } from './TransitPartChip.tsx';

// 10 areas in 2-column × 5-row grid
const AREA_COLORS: Record<string, string> = {
  'assembly-a': '#1e3a5f',
  'assembly-b': '#1e3a5f',
  'welding-a': '#3b1f2b',
  'welding-b': '#3b1f2b',
  'machining-a': '#2b3a1f',
  'machining-b': '#2b3a1f',
  'painting-a': '#1f3b2b',
  'painting-b': '#1f3b2b',
  'packaging-a': '#2b1f3b',
  'packaging-b': '#2b1f3b',
};

// Area background positions: { y: top, height }
const ROW_Y_STARTS = [10, 185, 360, 535, 710];
const AREA_POSITIONS: Record<string, { x: number; y: number; w: number; h: number; labelX: number; labelY: number }> = {};
const AREA_DEFS: Array<{ areaId: string; col: 0 | 1; row: number }> = [
  { areaId: 'assembly-a', col: 0, row: 0 },
  { areaId: 'assembly-b', col: 1, row: 0 },
  { areaId: 'welding-a', col: 0, row: 1 },
  { areaId: 'welding-b', col: 1, row: 1 },
  { areaId: 'machining-a', col: 0, row: 2 },
  { areaId: 'machining-b', col: 1, row: 2 },
  { areaId: 'painting-a', col: 0, row: 3 },
  { areaId: 'painting-b', col: 1, row: 3 },
  { areaId: 'packaging-a', col: 0, row: 4 },
  { areaId: 'packaging-b', col: 1, row: 4 },
];
for (const def of AREA_DEFS) {
  const x = def.col === 0 ? 10 : 810;
  const y = ROW_Y_STARTS[def.row];
  AREA_POSITIONS[def.areaId] = {
    x,
    y,
    w: 770,
    h: 165,
    labelX: x + 10,
    labelY: y + 14,
  };
}

export function FactoryFloorMap() {
  const layout = useStore(s => s.layout);
  const stations = useStore(s => s.stations);
  const sensors = useStore(s => s.sensors);
  const transitParts = useStore(s => s.transitParts);

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Waiting for factory data...
      </div>
    );
  }

  const stationConfigs = Object.values(layout.stations);

  // Build connection list from nextStations
  const connections: Array<{ from: string; to: string; isRework: boolean }> = [];
  for (const s of stationConfigs) {
    for (const next of s.nextStations) {
      connections.push({ from: s.stationId, to: next, isRework: false });
    }
    if (s.reworkTarget) {
      connections.push({ from: s.stationId, to: s.reworkTarget, isRework: true });
    }
  }

  // Collect transit parts as array
  const transitArray = [...transitParts.values()];

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full">
      <svg
        viewBox="0 0 1600 900"
        className="w-full h-full"
        style={{ minHeight: 400 }}
      >
        <defs>
          <marker id="arrowNormal" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#4b5563" />
          </marker>
          <marker id="arrowRework" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#f59e0b" />
          </marker>
          <marker id="arrowConveyor" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#6b7280" />
          </marker>
          <marker id="arrowConveyorRework" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
            <polygon points="0 0, 6 2, 0 4" fill="#f59e0b" />
          </marker>
          {/* Glow filter for highlights */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Area backgrounds */}
        {layout.areas.map(area => {
          const pos = AREA_POSITIONS[area.areaId];
          if (!pos) return null;
          return (
            <g key={area.areaId}>
              <rect
                x={pos.x}
                y={pos.y}
                width={pos.w}
                height={pos.h}
                rx={8}
                fill={AREA_COLORS[area.areaId] ?? '#1e293b'}
                opacity={0.4}
              />
              <text
                x={pos.labelX}
                y={pos.labelY}
                fontSize={10}
                fill="#94a3b8"
                fontWeight={700}
                style={{ textTransform: 'uppercase' }}
              >
                {area.name}
              </text>
            </g>
          );
        })}

        {/* Conveyor belts */}
        {connections.map(c => {
          const from = layout.stations[c.from];
          const to = layout.stations[c.to];
          if (!from || !to) return null;
          return (
            <ConveyorBelt
              key={`${c.from}-${c.to}`}
              id={`belt-${c.from}__${c.to}`}
              from={from}
              to={to}
              isRework={c.isRework}
            />
          );
        })}

        {/* Sensor nodes (read-only) */}
        {layout.sensors.map(sensorConfig => {
          const beltPathId = `belt-${sensorConfig.fromStationId}__${sensorConfig.toStationId}`;
          return (
            <SensorNode
              key={sensorConfig.sensorId}
              config={sensorConfig}
              state={sensors.get(sensorConfig.sensorId)}
              beltPathId={beltPathId}
            />
          );
        })}

        {/* Station nodes */}
        {stationConfigs.map(config => (
          <StationNode
            key={config.stationId}
            config={config}
            state={stations.get(config.stationId)}
          />
        ))}

        {/* Transit part chips (read-only) */}
        {transitArray.map(transit => {
          const beltPathId = `belt-${transit.fromStationId}__${transit.toStationId}`;
          return (
            <TransitPartChip
              key={transit.partId}
              transit={transit}
              beltPathId={beltPathId}
            />
          );
        })}

        {/* Legend */}
        <g transform="translate(10, 885)">
          <circle cx={8} cy={0} r={3} fill="#22c55e" />
          <text x={14} y={3} fontSize={8} fill="#9ca3af">Running</text>
          <circle cx={58} cy={0} r={3} fill="#6b7280" />
          <text x={64} y={3} fontSize={8} fill="#9ca3af">Idle</text>
          <circle cx={90} cy={0} r={3} fill="#ef4444" />
          <text x={96} y={3} fontSize={8} fill="#9ca3af">Error</text>
          <line x1={130} y1={0} x2={142} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={146} y={3} fontSize={8} fill="#9ca3af">Rework</text>
          <polygon points="190,0 194,-4 198,0 194,4" fill="#3b82f6" />
          <text x={202} y={3} fontSize={8} fill="#9ca3af">Sensor</text>
        </g>
      </svg>
    </div>
  );
}
