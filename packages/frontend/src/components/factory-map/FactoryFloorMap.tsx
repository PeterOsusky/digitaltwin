import { useStore } from '../../store/useStore.ts';
import { StationNode } from './StationNode.tsx';
import { ConveyorBelt } from './ConveyorBelt.tsx';

export function FactoryFloorMap() {
  const layout = useStore(s => s.layout);
  const stations = useStore(s => s.stations);

  if (!layout) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Waiting for factory data...
      </div>
    );
  }

  const stationConfigs = Object.values(layout.stations);

  // Build belt connections from nextStations
  const belts: Array<{ from: string; to: string }> = [];
  for (const s of stationConfigs) {
    for (const next of s.nextStations) {
      belts.push({ from: s.stationId, to: next });
    }
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 h-full">
      <svg
        viewBox="0 0 860 640"
        className="w-full h-full"
        style={{ minHeight: 400 }}
      >
        {/* Area sections (backgrounds) */}
        {layout.areas.map(area => (
          <g key={area.areaId}>
            <rect
              x={area.bounds.x}
              y={area.bounds.y}
              width={area.bounds.w}
              height={area.bounds.h}
              rx={8}
              fill={area.color}
              opacity={0.4}
            />
            <text
              x={area.bounds.x + 12}
              y={area.bounds.y + 18}
              fontSize={12}
              fill="#94a3b8"
              fontWeight={700}
              style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {area.name}
            </text>
          </g>
        ))}

        {/* Conveyor belts (render before stations so stations are on top) */}
        {belts.map(belt => {
          const from = layout.stations[belt.from];
          const to = layout.stations[belt.to];
          if (!from || !to) return null;
          return (
            <ConveyorBelt
              key={`${belt.from}-${belt.to}`}
              from={from}
              to={to}
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

        {/* Legend */}
        <g transform="translate(30, 625)">
          <circle cx={6} cy={0} r={5} fill="#22c55e" />
          <text x={16} y={4} fontSize={9} fill="#9ca3af">Online</text>
          <circle cx={76} cy={0} r={5} fill="#ef4444" />
          <text x={86} y={4} fontSize={9} fill="#9ca3af">Offline</text>
          <rect x={146} y={-6} width={12} height={12} rx={2} fill="#22c55e" opacity={0.9} />
          <text x={163} y={4} fontSize={9} fill="#9ca3af">OK</text>
          <rect x={193} y={-6} width={12} height={12} rx={2} fill="#ef4444" opacity={0.9} />
          <text x={210} y={4} fontSize={9} fill="#9ca3af">NOK</text>
          <line x1={240} y1={0} x2={270} y2={0} stroke="#6b7280" strokeWidth={2} strokeDasharray="8 12" />
          <text x={278} y={4} fontSize={9} fill="#9ca3af">Belt</text>
        </g>
      </svg>
    </div>
  );
}
