import { useState, useEffect, useMemo, useCallback } from 'react';
import { getTopicSnapshot, getTopicCount, getTotalReceived } from '../store/metricBuffer.ts';
import type { TopicRecord } from '../store/metricBuffer.ts';

/** How often we refresh the topic list (ms) */
const REFRESH_INTERVAL = 1000;

export function TopicDataViewer({ onClose }: { onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<Map<string, TopicRecord>>(new Map());
  const [filter, setFilter] = useState('');
  const [now, setNow] = useState(Date.now());

  // Refresh from metricBuffer every REFRESH_INTERVAL
  useEffect(() => {
    const tick = () => {
      setSnapshot(new Map(getTopicSnapshot()));
      setNow(Date.now());
    };
    tick();
    const id = setInterval(tick, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const entries = [...snapshot.entries()];
    if (!filter.trim()) return entries;
    const q = filter.toLowerCase();
    return entries.filter(([key]) => key.toLowerCase().includes(q));
  }, [snapshot, filter]);

  const formatAge = useCallback((receivedAt: number) => {
    const diff = Math.max(0, now - receivedAt);
    if (diff < 1000) return '<1s';
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
    return `${Math.floor(diff / 60_000)}m ${Math.floor((diff % 60_000) / 1000)}s`;
  }, [now]);

  const topicCount = getTopicCount();
  const totalReceived = getTotalReceived();

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-gray-900/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800/90 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-white">Topic Data Viewer</h2>
          <span className="text-xs text-gray-400">
            <span className="text-white font-bold">{topicCount.toLocaleString()}</span> topics
          </span>
          <span className="text-gray-600">|</span>
          <span className="text-xs text-gray-400">
            total: <span className="text-white font-bold">{(totalReceived / 1000).toFixed(1)}k</span> msgs
          </span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Filter topics..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 w-48 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_80px_60px_70px] gap-px px-4 py-1.5 text-[10px] text-gray-500 uppercase font-semibold border-b border-gray-700/50 bg-gray-800/50 shrink-0">
        <span>Topic Key</span>
        <span>Station</span>
        <span>Metric</span>
        <span className="text-right">Value</span>
        <span className="text-right">Age</span>
      </div>

      {/* Scrollable rows */}
      <div className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-500 text-xs">
            {topicCount === 0 ? 'Waiting for metric data...' : 'No topics match filter'}
          </div>
        ) : (
          filtered.map(([key, rec]) => (
            <div
              key={key}
              className="grid grid-cols-[1fr_120px_80px_60px_70px] gap-px px-4 py-1 text-xs border-b border-gray-800 hover:bg-gray-800/60"
            >
              <span className="text-gray-300 font-mono truncate">{key}</span>
              <span className="text-gray-400 truncate">{rec.stationId}</span>
              <span className="text-gray-400">{rec.metric}</span>
              <span className="text-white font-bold text-right tabular-nums">
                {typeof rec.value === 'number' ? rec.value.toFixed(1) : rec.value}
                <span className="text-gray-500 ml-0.5 text-[10px]">{rec.unit}</span>
              </span>
              <span className={`text-right tabular-nums ${
                now - rec.receivedAt < 2000 ? 'text-green-400' :
                now - rec.receivedAt < 10000 ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {formatAge(rec.receivedAt)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-1.5 border-t border-gray-700 bg-gray-800/50 text-[10px] text-gray-500">
        Showing {filtered.length.toLocaleString()} of {topicCount.toLocaleString()} topics
        {filter && <span className="ml-2 text-gray-600">| filter: "{filter}"</span>}
      </div>
    </div>
  );
}
