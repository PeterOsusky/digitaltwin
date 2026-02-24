import { useStore } from '../store/useStore.ts';

export function Header() {
  const connected = useStore(s => s.connected);
  const stations = useStore(s => s.stations);
  const onlineCount = [...stations.values()].filter(s => s.status === 'online').length;

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-sm font-bold text-white">Digital Twin</h1>
        <span className="text-[10px] text-gray-500">POC</span>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="text-gray-400">
          Stations: <span className="text-white font-bold">{onlineCount}/{stations.size}</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-[10px] text-gray-400">{connected ? 'Live' : 'Off'}</span>
      </div>
    </header>
  );
}
