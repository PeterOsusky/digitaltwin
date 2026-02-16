import type { PartHistoryEntry, PartSensorEvent, FactoryLayout } from '../../types.ts';
import { formatTime, formatDuration } from '../../utils/format.ts';

interface Props {
  history: PartHistoryEntry[];
  sensorEvents: PartSensorEvent[];
  layout: FactoryLayout | null;
}

interface TimelineRow {
  key: string;
  time: string;
  type: 'enter' | 'process' | 'exit' | 'sensor';
  label: string;
  dotColor: string;
  badge?: { text: string; color: string };
  progressPct?: number;
  isActive?: boolean;
}

const DECISION_BADGE: Record<string, { text: string; color: string }> = {
  pass: { text: 'PASS', color: 'bg-green-600' },
  fail: { text: 'FAIL', color: 'bg-red-600' },
  rework: { text: 'REWORK', color: 'bg-amber-600' },
  skip_process: { text: 'SKIP', color: 'bg-purple-600' },
};

const RESULT_BADGE: Record<string, { text: string; color: string }> = {
  ok: { text: 'OK', color: 'bg-green-500' },
  rework: { text: 'REWORK', color: 'bg-amber-500' },
  nok: { text: 'NOK', color: 'bg-red-500' },
};

export function PartTimeline({ history, sensorEvents, layout }: Props) {
  if (history.length === 0 && sensorEvents.length === 0) {
    return <p className="text-gray-500 text-xs">No history yet</p>;
  }

  // Build flat chronological list of rows
  const rows: TimelineRow[] = [];

  // Add station ENTER / PROCESS / EXIT rows
  for (let i = 0; i < history.length; i++) {
    const entry = history[i];
    const stationConfig = layout?.stations[entry.stationId];
    const stationLabel = stationConfig
      ? `#${stationConfig.displayId} ${stationConfig.name}`
      : entry.stationId;
    const isActive = !entry.exitedAt;

    // ENTER
    rows.push({
      key: `enter-${i}`,
      time: entry.enteredAt,
      type: 'enter',
      label: `ENTER  ${stationLabel}`,
      dotColor: 'bg-blue-500 border-blue-400',
      isActive,
    });

    // PROCESS (only when actively processing)
    if (isActive && entry.progressPct > 0) {
      rows.push({
        key: `process-${i}`,
        time: entry.enteredAt + '_process', // sort after enter
        type: 'process',
        label: `PROCESS  ${entry.progressPct}%`,
        dotColor: 'bg-yellow-500 border-yellow-400',
        progressPct: entry.progressPct,
      });
    }

    // EXIT
    if (entry.exitedAt) {
      const cycleLabel = entry.cycleTimeMs != null ? ` (${formatDuration(entry.cycleTimeMs)})` : '';
      rows.push({
        key: `exit-${i}`,
        time: entry.exitedAt,
        type: 'exit',
        label: `EXIT  ${stationLabel}${cycleLabel}`,
        dotColor: entry.result === 'nok'
          ? 'bg-red-500 border-red-400'
          : entry.result === 'rework'
            ? 'bg-amber-500 border-amber-400'
            : 'bg-green-500 border-green-400',
        badge: entry.result ? RESULT_BADGE[entry.result] : undefined,
      });
    }
  }

  // Add sensor event rows
  for (let i = 0; i < sensorEvents.length; i++) {
    const se = sensorEvents[i];
    const sensorConfig = layout?.sensors.find(s => s.sensorId === se.sensorId);
    const sensorLabel = sensorConfig?.displayId ?? se.sensorId;
    const fromConfig = layout?.stations[se.fromStationId];
    const toConfig = layout?.stations[se.toStationId];
    const routeLabel = fromConfig && toConfig
      ? `${fromConfig.displayId} → ${toConfig.displayId}`
      : `${se.fromStationId} → ${se.toStationId}`;

    rows.push({
      key: `sensor-${i}`,
      time: se.timestamp,
      type: 'sensor',
      label: `SENSOR  ${sensorLabel}  (${routeLabel})`,
      dotColor: se.decision === 'fail'
        ? 'bg-red-500 border-red-400'
        : se.decision === 'rework'
          ? 'bg-amber-500 border-amber-400'
          : se.decision === 'skip_process'
            ? 'bg-purple-500 border-purple-400'
            : 'bg-green-500 border-green-400',
      badge: DECISION_BADGE[se.decision],
    });
  }

  // Sort chronologically (enter before process at same time)
  rows.sort((a, b) => a.time.localeCompare(b.time));

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gray-700" />

      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.key} className="relative pl-6 py-0.5">
            {/* Dot */}
            <div
              className={`absolute left-0.5 top-1.5 w-3 h-3 rounded-full border-2 ${row.dotColor}`}
            />
            <div className="text-xs flex items-center gap-1.5 flex-wrap">
              {/* Timestamp */}
              {row.type !== 'process' ? (
                <span className="text-gray-500 font-mono text-[10px] w-[90px] shrink-0">
                  {formatTime(row.time)}
                </span>
              ) : (
                <span className="w-[90px] shrink-0" />
              )}

              {/* Type tag */}
              <span className={`font-bold text-[10px] px-1 py-0 rounded ${
                row.type === 'enter' ? 'bg-blue-900/60 text-blue-300' :
                row.type === 'exit' ? 'bg-gray-700 text-gray-300' :
                row.type === 'sensor' ? 'bg-purple-900/60 text-purple-300' :
                'bg-yellow-900/60 text-yellow-300'
              }`}>
                {row.type === 'enter' ? 'ENT' :
                 row.type === 'exit' ? 'EXIT' :
                 row.type === 'sensor' ? 'SNS' : 'PROC'}
              </span>

              {/* Label */}
              <span className="text-gray-300 truncate">{
                // Strip the type prefix from label for cleaner display
                row.label.replace(/^(ENTER|EXIT|PROCESS|SENSOR)\s+/, '')
              }</span>

              {/* Badge */}
              {row.badge && (
                <span className={`${row.badge.color} text-white font-bold text-[9px] px-1.5 py-0 rounded`}>
                  {row.badge.text}
                </span>
              )}

              {/* Progress bar for PROCESS */}
              {row.type === 'process' && row.progressPct != null && (
                <div className="w-[60px] bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-yellow-500 h-1.5 rounded-full transition-all duration-1000"
                    style={{ width: `${row.progressPct}%` }}
                  />
                </div>
              )}

              {/* ACTIVE badge */}
              {row.type === 'enter' && row.isActive && (
                <span className="bg-green-600 text-white px-1.5 py-0 rounded text-[9px] font-bold animate-pulse">
                  ACTIVE
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
