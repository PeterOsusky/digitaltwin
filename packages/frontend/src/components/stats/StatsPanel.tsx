import { useStore } from '../../store/useStore.ts';

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-gray-700/50 rounded-lg p-3 text-center">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

export function StatsPanel() {
  const parts = useStore(s => s.parts);
  const stations = useStore(s => s.stations);

  const allParts = [...parts.values()];
  const active = allParts.filter(p => p.status === 'in_station' || p.status === 'in_transit').length;
  const completed = allParts.filter(p => p.status === 'completed').length;
  const scrapped = allParts.filter(p => p.status === 'scrapped').length;
  const runningStations = [...stations.values()].filter(s => s.status === 'running').length;
  const totalStations = stations.size;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 h-full">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-3">Statistics</h3>
      <div className="grid grid-cols-2 gap-2">
        <StatCard label="Active Parts" value={active} color="text-green-400" />
        <StatCard label="Completed" value={completed} color="text-blue-400" />
        <StatCard label="Scrapped" value={scrapped} color="text-red-400" />
        <StatCard label="Stations Busy" value={`${runningStations}/${totalStations}`} color="text-amber-400" />
      </div>
    </div>
  );
}
