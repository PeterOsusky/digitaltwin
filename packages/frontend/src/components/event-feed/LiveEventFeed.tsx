import { useStore } from '../../store/useStore.ts';
import { formatTime, shortPartId } from '../../utils/format.ts';
import type { LiveEvent } from '../../types.ts';

const EVENT_COLORS: Record<string, string> = {
  part_enter: 'text-blue-400',
  part_exit: 'text-green-400',
  station_status: 'text-gray-400',
  error: 'text-red-400',
};

const EVENT_ICONS: Record<string, string> = {
  part_enter: '\u25B6',  // play
  part_exit: '\u2714',   // check
  station_status: '\u26A0',
  error: '\u2716',       // x
};

function EventRow({ event }: { event: LiveEvent }) {
  const selectPart = useStore(s => s.selectPart);
  const color = EVENT_COLORS[event.type] ?? 'text-gray-400';

  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-gray-700/50">
      <span className="text-gray-500 shrink-0 w-16">{formatTime(event.timestamp)}</span>
      <span className={`${color} shrink-0`}>{EVENT_ICONS[event.type]}</span>
      <span className="text-gray-300 flex-1">
        {event.message}
      </span>
      {event.partId && (
        <button
          onClick={() => selectPart(event.partId!)}
          className="text-blue-400 hover:text-blue-300 shrink-0"
        >
          {shortPartId(event.partId)}
        </button>
      )}
    </div>
  );
}

export function LiveEventFeed() {
  const events = useStore(s => s.events);

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-3 h-full overflow-hidden flex flex-col">
      <h3 className="text-xs font-semibold text-gray-400 uppercase mb-2">Live Events</h3>
      <div className="flex-1 overflow-auto space-y-0">
        {events.length === 0 ? (
          <p className="text-gray-500 text-xs">Waiting for events...</p>
        ) : (
          events.map(e => <EventRow key={e.id} event={e} />)
        )}
      </div>
    </div>
  );
}
