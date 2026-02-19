import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore.ts';
import { shortPartId, formatDuration } from '../utils/format.ts';
import { usePerfStats } from '../hooks/usePerfStats.ts';

export function Header({ onToggleTopics, showTopics }: { onToggleTopics: () => void; showTopics: boolean }) {
  const connected = useStore(s => s.connected);
  const parts = useStore(s => s.parts);
  const selectPart = useStore(s => s.selectPart);
  const selectStation = useStore(s => s.selectStation);
  const getStats = useStore(s => s.getStats);
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);

  const stats = getStats();
  const perf = usePerfStats();

  const results = useCallback(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return [...parts.values()]
      .filter(p => p.partId.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, parts])();

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-1.5 flex items-center justify-between gap-4">
      {/* Title */}
      <div className="flex items-center gap-2 shrink-0">
        <h1 className="text-sm font-bold text-white">Digital Twin</h1>
        <span className="text-[10px] text-gray-500">POC</span>
      </div>

      {/* Compact stats */}
      <div className="flex items-center gap-4 text-xs overflow-hidden">
        <StatChip label="Active" value={stats.activeParts} color="text-green-400" />
        <StatChip label="Done" value={stats.completedParts} color="text-blue-400" />
        <StatChip label="Scrap" value={stats.scrappedParts} color="text-red-400" />
        <span className="text-gray-600">|</span>
        <StatChip label="Busy" value={`${stats.runningStations}/${stats.totalStations}`} color="text-amber-400" />
        <StatChip label="Avg" value={stats.avgCycleTimeMs > 0 ? formatDuration(stats.avgCycleTimeMs) : '-'} color="text-white" />
        <StatChip label="Rework" value={stats.reworkRate > 0 ? `${stats.reworkRate.toFixed(1)}%` : '-'} color="text-amber-400" />
        <StatChip label="Thrpt" value={stats.throughputPerMin > 0 ? `${stats.throughputPerMin.toFixed(1)}/m` : '-'} color="text-cyan-400" />
      </div>

      {/* Perf stats — visible when topics > 50 */}
      {perf.uniqueTopics > 50 && (
        <div className="flex items-center gap-3 text-[10px] bg-purple-900/40 border border-purple-700/40 rounded px-2.5 py-1 shrink-0">
          <span className="text-purple-400 font-bold">STRESS</span>
          <span className="text-gray-300">
            <span className="text-white font-bold">{perf.uniqueTopics.toLocaleString()}</span> topics
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">
            <span className="text-white font-bold">{perf.metricsPerSecond.toLocaleString()}</span> msg/s
          </span>
          <span className="text-gray-500">|</span>
          <span className={`font-bold ${perf.lastUpdateMs < 16 ? 'text-green-400' : perf.lastUpdateMs < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
            {perf.lastUpdateMs.toFixed(1)}ms
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-300">
            total: <span className="text-white font-bold">{(perf.totalMetricsReceived / 1000).toFixed(1)}k</span>
          </span>
        </div>
      )}

      {/* Topics toggle + Search + connection */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onToggleTopics}
          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
            showTopics
              ? 'bg-cyan-900/60 border-cyan-600 text-cyan-300'
              : 'bg-gray-700 border-gray-600 text-gray-400 hover:text-white hover:border-gray-500'
          }`}
        >
          Topics
        </button>
        <div className="relative">
          <input
            type="text"
            placeholder="Search part..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setShowResults(true); }}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onFocus={() => query && setShowResults(true)}
            className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-white placeholder-gray-500 w-36 focus:outline-none focus:border-blue-500"
          />
          {showResults && results.length > 0 && (
            <div className="absolute top-full right-0 mt-1 bg-gray-700 border border-gray-600 rounded shadow-lg z-50 w-56">
              {results.map(p => (
                <button
                  key={p.partId}
                  onClick={() => { selectPart(p.partId); selectStation(null); setQuery(''); setShowResults(false); }}
                  className="w-full px-3 py-2 text-left text-xs hover:bg-gray-600 flex justify-between"
                >
                  <span className="text-white">{shortPartId(p.partId)}</span>
                  <span className="text-gray-400">{p.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-[10px] text-gray-400">{connected ? 'Live' : 'Off'}</span>
        </div>
      </div>
    </header>
  );
}

function StatChip({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`${color} font-bold`}>{value}</span>
      <span className="text-gray-500">{label}</span>
    </div>
  );
}
