import { useState } from 'react';
import { useStore } from '../store/useStore.ts';
import { formatTime, shortPartId } from '../utils/format.ts';
import type { LiveEvent } from '../types.ts';

const EVENT_COLORS: Record<string, string> = {
  part_enter: 'text-blue-400',
  part_exit: 'text-green-400',
  station_status: 'text-gray-400',
  error: 'text-red-400',
  sensor: 'text-purple-400',
};

const EVENT_ICONS: Record<string, string> = {
  part_enter: '\u25B6',  // play
  part_exit: '\u2714',   // check
  station_status: '\u26A0',
  error: '\u2716',       // x
  sensor: '\u25C6',      // diamond
};

function EventRow({ event }: { event: LiveEvent }) {
  const selectPart = useStore(s => s.selectPart);
  const selectStation = useStore(s => s.selectStation);
  const color = EVENT_COLORS[event.type] ?? 'text-gray-400';

  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-gray-700/50">
      <span className="text-gray-500 shrink-0 w-14">{formatTime(event.timestamp)}</span>
      <span className={`${color} shrink-0`}>{EVENT_ICONS[event.type]}</span>
      <span className="text-gray-300 flex-1">{event.message}</span>
      {event.partId && (
        <button
          onClick={() => { selectPart(event.partId!); selectStation(null); }}
          className="text-blue-400 hover:text-blue-300 shrink-0"
        >
          {shortPartId(event.partId)}
        </button>
      )}
    </div>
  );
}

export function EventDrawer() {
  const events = useStore(s => s.events);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      {/* Toggle bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-1.5 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 hover:bg-gray-700/80 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase">Events</span>
          <span className="text-xs text-gray-500">({events.length})</span>
          {events.length > 0 && events[0].type === 'error' && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </div>
        <span className="text-gray-500 text-xs">
          {isOpen ? '\u25BC' : '\u25B2'}
        </span>
      </button>

      {/* Expandable content */}
      <div
        className="bg-gray-800/95 backdrop-blur-sm overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '250px' : '0px' }}
      >
        <div className="p-3 overflow-auto" style={{ maxHeight: '240px' }}>
          {events.length === 0 ? (
            <p className="text-gray-500 text-xs">Waiting for events...</p>
          ) : (
            events.map(e => <EventRow key={e.id} event={e} />)
          )}
        </div>
      </div>
    </div>
  );
}
