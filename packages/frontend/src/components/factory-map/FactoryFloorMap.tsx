import { useStore } from '../../store/useStore.ts';
import { StationNode } from './StationNode.tsx';
import { ConveyorBelt } from './ConveyorBelt.tsx';
import { SensorNode } from './SensorNode.tsx';
import { TransitPartChip } from './TransitPartChip.tsx';

const AREA_COLORS: Record<string, string> = {
  assembly: '#1e3a5f',
  welding: '#3b1f2b',
  painting: '#1f3b2b',
};

const AREA_LABELS: Record<string, { x: number; y: number }> = {
  assembly: { x: 20, y: 60 },
  welding: { x: 20, y: 240 },
  painting: { x: 20, y: 430 },
};

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
        viewBox="0 0 900 570"
        className="w-full h-full"
        style={{ minHeight: 300 }}
      >
        <defs>
          <marker id="arrowNormal" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
          </marker>
          <marker id="arrowRework" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
          </marker>
          <marker id="arrowConveyor" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
          </marker>
          <marker id="arrowConveyorRework" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#f59e0b" />
          </marker>
          {/* Glow filter for highlights */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Area backgrounds */}
        {layout.areas.map(area => (
          <g key={area.areaId}>
            <rect
              x={10}
              y={AREA_LABELS[area.areaId]?.y ? AREA_LABELS[area.areaId].y - 20 : 0}
              width={880}
              height={160}
              rx={10}
              fill={AREA_COLORS[area.areaId] ?? '#1e293b'}
              opacity={0.4}
            />
            <text
              x={AREA_LABELS[area.areaId]?.x ?? 20}
              y={AREA_LABELS[area.areaId]?.y ?? 40}
              fontSize={14}
              fill="#94a3b8"
              fontWeight={700}
              style={{ textTransform: 'uppercase' }}
            >
              {area.name}
            </text>
          </g>
        ))}

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
        <g transform="translate(10, 545)">
          <circle cx={8} cy={0} r={4} fill="#22c55e" />
          <text x={16} y={3} fontSize={9} fill="#9ca3af">Running</text>
          <circle cx={70} cy={0} r={4} fill="#6b7280" />
          <text x={78} y={3} fontSize={9} fill="#9ca3af">Idle</text>
          <circle cx={110} cy={0} r={4} fill="#ef4444" />
          <text x={118} y={3} fontSize={9} fill="#9ca3af">Error</text>
          <line x1={162} y1={0} x2={178} y2={0} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 2" />
          <text x={182} y={3} fontSize={9} fill="#9ca3af">Rework</text>
          <polygon points="230,0 235,-5 240,0 235,5" fill="#3b82f6" />
          <text x={245} y={3} fontSize={9} fill="#9ca3af">Sensor</text>
        </g>
      </svg>
    </div>
  );
}
