import { useStore } from '../../store/useStore.ts';
import { PartTimeline } from './PartTimeline.tsx';
import { formatTime } from '../../utils/format.ts';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  in_station: { label: 'In Station', color: 'bg-green-600' },
  in_transit: { label: 'In Transit', color: 'bg-blue-600' },
  completed: { label: 'Completed', color: 'bg-gray-600' },
  scrapped: { label: 'Scrapped', color: 'bg-red-600' },
};

export function PartDetailPanel() {
  const selectedPartId = useStore(s => s.selectedPartId);
  const parts = useStore(s => s.parts);
  const layout = useStore(s => s.layout);
  const selectPart = useStore(s => s.selectPart);

  if (!selectedPartId) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full flex items-center justify-center">
        <p className="text-gray-500 text-sm text-center">
          Click on a part chip on the factory map<br />to view its details and history
        </p>
      </div>
    );
  }

  const part = parts.get(selectedPartId);
  if (!part) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full">
        <p className="text-gray-500">Part not found</p>
      </div>
    );
  }

  const badge = STATUS_BADGES[part.status] ?? STATUS_BADGES.in_transit;
  const currentStationName = part.currentStation
    ? layout?.stations[part.currentStation]?.name ?? part.currentStation
    : null;

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{part.partId}</h3>
        <button
          onClick={() => selectPart(null)}
          className="text-gray-500 hover:text-gray-300 text-xs"
        >
          [close]
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Status</span>
          <span className={`${badge.color} px-2 py-0.5 rounded-full text-white text-xs`}>
            {badge.label}
          </span>
        </div>
        {currentStationName && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">Current</span>
            <span className="text-white">{currentStationName}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Created</span>
          <span className="text-white">{formatTime(part.createdAt)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Steps</span>
          <span className="text-white">{part.history.length}</span>
        </div>
      </div>

      <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">History</h4>
      <PartTimeline history={part.history} sensorEvents={part.sensorEvents ?? []} layout={layout} />
    </div>
  );
}
