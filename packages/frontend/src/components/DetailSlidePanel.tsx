import { useStore } from '../store/useStore.ts';
import { PartTimeline } from './part-detail/PartTimeline.tsx';
import { formatTime, formatDuration, shortPartId } from '../utils/format.ts';
import { sendWsMessage } from '../hooks/useWebSocket.ts';
import { OkNokPieChart } from './charts/OkNokPieChart.tsx';
import { StationHealthIndicator } from './charts/StationHealthIndicator.tsx';
import { STATION_METRIC_CONFIGS } from '../config/station-metrics.ts';
import type { StationType } from '../types.ts';

const STATUS_BADGES: Record<string, { label: string; color: string }> = {
  in_station: { label: 'In Station', color: 'bg-green-600' },
  in_transit: { label: 'In Transit', color: 'bg-blue-600' },
  completed: { label: 'Completed', color: 'bg-gray-600' },
  scrapped: { label: 'Scrapped', color: 'bg-red-600' },
};

const STATION_STATUS_COLORS: Record<string, string> = {
  running: 'text-green-400',
  idle: 'text-gray-400',
  error: 'text-red-400',
  offline: 'text-gray-600',
};

const RESULT_COLORS: Record<string, string> = {
  ok: 'text-green-400',
  rework: 'text-amber-400',
  nok: 'text-red-400',
};

const DECISION_COLORS: Record<string, string> = {
  pass: 'text-green-400',
  fail: 'text-red-400',
  rework: 'text-amber-400',
  skip_process: 'text-purple-400',
};

const SENSOR_TYPE_LABELS: Record<string, string> = {
  data_check: 'Data Check',
  routing: 'Routing',
  process_decision: 'Process Decision',
};

export function DetailSlidePanel() {
  const selectedPartId = useStore(s => s.selectedPartId);
  const selectedStationId = useStore(s => s.selectedStationId);
  const selectedSensorId = useStore(s => s.selectedSensorId);
  const parts = useStore(s => s.parts);
  const stations = useStore(s => s.stations);
  const sensors = useStore(s => s.sensors);
  const transitParts = useStore(s => s.transitParts);
  const layout = useStore(s => s.layout);
  const selectPart = useStore(s => s.selectPart);
  const selectStation = useStore(s => s.selectStation);
  const selectSensor = useStore(s => s.selectSensor);
  const getStationHistory = useStore(s => s.getStationHistory);

  const isOpen = selectedPartId !== null || selectedStationId !== null || selectedSensorId !== null;

  const handleClose = () => {
    selectPart(null);
    selectStation(null);
    selectSensor(null);
  };

  // Determine title
  let title = 'Detail';
  if (selectedPartId) title = 'Part Detail';
  else if (selectedStationId) title = 'Station Detail';
  else if (selectedSensorId) title = 'Sensor Detail';

  return (
    <div
      className="absolute top-0 right-0 h-full w-[420px] z-20 transition-transform duration-300 ease-in-out"
      style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
    >
      <div className="h-full bg-gray-800/95 backdrop-blur-sm border-l border-gray-700 shadow-2xl overflow-auto">
        {/* Close button */}
        <div className="sticky top-0 bg-gray-800/95 backdrop-blur-sm z-10 flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white text-lg leading-none px-1"
          >
            &times;
          </button>
        </div>

        <div className="p-4">
          {selectedPartId && (
            <PartDetail
              partId={selectedPartId}
              parts={parts}
              transitParts={transitParts}
              sensors={sensors}
              layout={layout}
              selectStation={selectStation}
              selectPart={selectPart}
              selectSensor={selectSensor}
            />
          )}
          {selectedStationId && !selectedPartId && (
            <StationDetail
              stationId={selectedStationId}
              stations={stations}
              layout={layout}
              getStationHistory={getStationHistory}
              selectPart={selectPart}
              selectStation={selectStation}
            />
          )}
          {selectedSensorId && !selectedPartId && !selectedStationId && (
            <SensorDetail
              sensorId={selectedSensorId}
              sensors={sensors}
              parts={parts}
              layout={layout}
              selectPart={selectPart}
              selectStation={selectStation}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Part Detail sub-component ----

function PartDetail({
  partId, parts, transitParts, sensors, layout, selectStation, selectPart, selectSensor,
}: {
  partId: string;
  parts: Map<string, import('../types.ts').Part>;
  transitParts: Map<string, import('../types.ts').TransitPart>;
  sensors: Map<string, import('../types.ts').SensorState>;
  layout: import('../types.ts').FactoryLayout | null;
  selectStation: (id: string | null) => void;
  selectPart: (id: string | null) => void;
  selectSensor: (id: string | null) => void;
}) {
  const part = parts.get(partId);
  if (!part) return <p className="text-gray-500 text-sm">Part not found</p>;

  const badge = STATUS_BADGES[part.status] ?? STATUS_BADGES.in_transit;
  const currentStationConfig = part.currentStation ? layout?.stations[part.currentStation] : null;

  // Check if part is stopped at a sensor (transit stopped = true)
  const transit = transitParts.get(partId);
  const isStoppedAtSensor = transit?.stopped === true;

  // Find the sensor that stopped this part
  const lastFailEvent = part.sensorEvents?.length
    ? [...part.sensorEvents].reverse().find(se => se.decision === 'fail')
    : null;
  const failSensorConfig = lastFailEvent
    ? layout?.sensors.find(s => s.sensorId === lastFailEvent.sensorId)
    : null;

  return (
    <div className="space-y-4">
      {/* Part ID + Status */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg font-bold text-white">{shortPartId(part.partId)}</span>
          <span className={`${badge.color} px-2 py-0.5 rounded-full text-white text-xs`}>
            {badge.label}
          </span>
        </div>
        <p className="text-xs text-gray-500 font-mono">{part.partId}</p>
      </div>

      {/* Stopped at sensor alert — only show when part is currently scrapped/stopped */}
      {(isStoppedAtSensor || (lastFailEvent && part.status === 'scrapped')) && (
        <div className="bg-red-900/40 border border-red-700/60 rounded p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-red-400 font-bold text-xs">⚠ STOPPED AT SENSOR</span>
          </div>
          {failSensorConfig && (
            <button
              onClick={() => { selectSensor(failSensorConfig.sensorId); selectPart(null); }}
              className="text-red-300 hover:text-red-200 text-xs font-semibold underline"
            >
              {failSensorConfig.displayId} ({SENSOR_TYPE_LABELS[failSensorConfig.type] ?? failSensorConfig.type})
            </button>
          )}
          {lastFailEvent && (
            <p className="text-xs text-gray-400 mt-1">
              Failed at {formatTime(lastFailEvent.timestamp)}
              {' · '}
              {layout?.stations[lastFailEvent.fromStationId]?.displayId ?? lastFailEvent.fromStationId}
              {' → '}
              {layout?.stations[lastFailEvent.toStationId]?.displayId ?? lastFailEvent.toStationId}
            </p>
          )}
          <button
            onClick={() => {
              sendWsMessage({
                type: 'override_part',
                partId,
                fromStationId: lastFailEvent?.fromStationId ?? transit?.fromStationId,
                toStationId: lastFailEvent?.toStationId ?? transit?.toStationId,
                failedSensorId: lastFailEvent?.sensorId,
              });
            }}
            className="mt-2 w-full bg-green-700 hover:bg-green-600 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors"
          >
            ✓ Override OK — pokračovať
          </button>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {currentStationConfig && (
          <div className="bg-gray-700/50 rounded p-2">
            <span className="text-gray-400 block">Current Station</span>
            <button
              onClick={() => { selectStation(currentStationConfig.stationId); selectPart(null); }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              #{currentStationConfig.displayId} {currentStationConfig.name}
            </button>
          </div>
        )}
        <div className="bg-gray-700/50 rounded p-2">
          <span className="text-gray-400 block">Created</span>
          <span className="text-white">{formatTime(part.createdAt)}</span>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <span className="text-gray-400 block">Steps</span>
          <span className="text-white font-semibold">{part.history.length}</span>
        </div>
        <div className="bg-gray-700/50 rounded p-2">
          <span className="text-gray-400 block">Area</span>
          <span className="text-white capitalize">{part.currentArea ?? part.history[0]?.area ?? '-'}</span>
        </div>
        {part.sensorEvents && part.sensorEvents.length > 0 && (
          <div className="bg-gray-700/50 rounded p-2">
            <span className="text-gray-400 block">Sensor Checks</span>
            <span className="text-white font-semibold">{part.sensorEvents.length}</span>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Journey History</h4>
        <PartTimeline
          history={part.history}
          sensorEvents={part.sensorEvents ?? []}
          layout={layout}
        />
      </div>
    </div>
  );
}

// ---- Station Detail sub-component ----

function StationDetail({
  stationId, stations, layout, getStationHistory, selectPart, selectStation,
}: {
  stationId: string;
  stations: Map<string, import('../types.ts').StationState>;
  layout: import('../types.ts').FactoryLayout | null;
  getStationHistory: (id: string) => import('../types.ts').Part[];
  selectPart: (id: string | null) => void;
  selectStation: (id: string | null) => void;
}) {
  const stationConfig = layout?.stations[stationId];
  const stationState = stations.get(stationId);
  const stationParts = getStationHistory(stationId);

  if (!stationConfig) return <p className="text-gray-500 text-sm">Station not found</p>;

  const statusColor = STATION_STATUS_COLORS[stationState?.status ?? 'offline'] ?? 'text-gray-500';

  return (
    <div className="space-y-4">
      {/* Station header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-white">#{stationConfig.displayId}</span>
          <span className="text-gray-300">{stationConfig.name}</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`${statusColor} font-semibold uppercase`}>
            {stationState?.status ?? 'offline'}
          </span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">{stationConfig.type.toUpperCase()}</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400 capitalize">{stationConfig.area}</span>
        </div>
      </div>

      {/* Current part */}
      {stationState?.currentPartId && (
        <div className="bg-blue-900/30 border border-blue-700/50 rounded p-2">
          <span className="text-xs text-gray-400">Currently processing: </span>
          <button
            onClick={() => { selectPart(stationState.currentPartId!); selectStation(null); }}
            className="text-blue-400 hover:text-blue-300 text-xs font-semibold"
          >
            {shortPartId(stationState.currentPartId)}
          </button>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Output</span>
          <span className="text-white font-bold text-sm">{stationState?.metrics.outputCount ?? 0}</span>
        </div>
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Cycle Time</span>
          <span className="text-white font-bold text-sm">
            {stationState?.metrics.cycleTime ? formatDuration(stationState.metrics.cycleTime) : '-'}
          </span>
        </div>
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Temp</span>
          <span className="text-orange-400 font-bold text-sm">
            {stationState?.metrics.temperature != null ? `${stationState.metrics.temperature.toFixed(1)}\u00B0` : '-'}
          </span>
        </div>
      </div>

      {/* OK/NOK/Rework pie chart */}
      {stationState?.counters && (stationState.counters.ok + stationState.counters.nok + stationState.counters.rework > 0) && (
        <div>
          <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Result Distribution</h4>
          <div className="flex items-center gap-4">
            <OkNokPieChart counters={stationState.counters} size={90} />
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                <span className="text-gray-300">OK: {stationState.counters.ok}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-gray-300">NOK: {stationState.counters.nok}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <span className="text-gray-300">Rework: {stationState.counters.rework}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Metric sparklines per station type */}
      {(() => {
        const metricConfigs = STATION_METRIC_CONFIGS[stationConfig.type as StationType] ?? [];
        const history = stationState?.metricHistory ?? {};
        if (metricConfigs.length === 0) return null;
        return (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">Live Metrics</h4>
            <StationHealthIndicator configs={metricConfigs} metricHistory={history} />
          </div>
        );
      })()}

      {/* Recent parts */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Recent Parts ({stationParts.length})
        </h4>
        {stationParts.length === 0 ? (
          <p className="text-gray-500 text-xs">No parts have passed through yet</p>
        ) : (
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {stationParts.map(p => {
              const entry = [...p.history].reverse().find(h => h.stationId === stationId);
              if (!entry) return null;
              return (
                <button
                  key={p.partId}
                  onClick={() => { selectPart(p.partId); selectStation(null); }}
                  className="w-full flex items-center justify-between text-xs bg-gray-700/30 hover:bg-gray-700/60 rounded px-2 py-1.5 transition-colors"
                >
                  <span className="text-blue-400 font-semibold">{shortPartId(p.partId)}</span>
                  <div className="flex items-center gap-2">
                    {entry.result && (
                      <span className={`font-bold ${RESULT_COLORS[entry.result] ?? 'text-gray-400'}`}>
                        {entry.result.toUpperCase()}
                      </span>
                    )}
                    {entry.cycleTimeMs != null && (
                      <span className="text-gray-500">{formatDuration(entry.cycleTimeMs)}</span>
                    )}
                    {!entry.exitedAt && (
                      <span className="text-green-400 font-bold animate-pulse">ACTIVE</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Sensor Detail sub-component ----

function SensorDetail({
  sensorId, sensors, parts, layout, selectPart, selectStation,
}: {
  sensorId: string;
  sensors: Map<string, import('../types.ts').SensorState>;
  parts: Map<string, import('../types.ts').Part>;
  layout: import('../types.ts').FactoryLayout | null;
  selectPart: (id: string | null) => void;
  selectStation: (id: string | null) => void;
}) {
  const sensorConfig = layout?.sensors.find(s => s.sensorId === sensorId);
  const sensorState = sensors.get(sensorId);

  if (!sensorConfig) return <p className="text-gray-500 text-sm">Sensor not found</p>;

  const fromStation = layout?.stations[sensorConfig.fromStationId];
  const toStation = layout?.stations[sensorConfig.toStationId];

  // Recent events for this sensor across all parts
  const recentEvents: Array<{ partId: string; decision: string; timestamp: string }> = [];
  for (const part of parts.values()) {
    for (const se of (part.sensorEvents ?? [])) {
      if (se.sensorId === sensorId) {
        recentEvents.push({ partId: part.partId, decision: se.decision, timestamp: se.timestamp });
      }
    }
  }
  recentEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const displayEvents = recentEvents.slice(0, 30);

  const totalChecks = recentEvents.length;
  const failCount = recentEvents.filter(e => e.decision === 'fail').length;
  const passCount = recentEvents.filter(e => e.decision === 'pass').length;
  const reworkCount = recentEvents.filter(e => e.decision === 'rework').length;

  return (
    <div className="space-y-4">
      {/* Sensor header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-bold text-white">{sensorConfig.displayId}</span>
          <span className={`px-2 py-0.5 rounded-full text-white text-xs ${
            sensorConfig.type === 'data_check' ? 'bg-blue-600' :
            sensorConfig.type === 'routing' ? 'bg-amber-600' : 'bg-purple-600'
          }`}>
            {SENSOR_TYPE_LABELS[sensorConfig.type] ?? sensorConfig.type}
          </span>
        </div>
        <p className="text-xs text-gray-500 font-mono">{sensorConfig.sensorId}</p>
      </div>

      {/* Route */}
      <div className="bg-gray-700/50 rounded p-3 text-xs">
        <span className="text-gray-400 block mb-1">Position on Belt</span>
        <div className="flex items-center gap-2">
          {fromStation && (
            <button
              onClick={() => { selectStation(fromStation.stationId); }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              #{fromStation.displayId} {fromStation.name}
            </button>
          )}
          <span className="text-gray-500">→</span>
          {toStation && (
            <button
              onClick={() => { selectStation(toStation.stationId); }}
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              #{toStation.displayId} {toStation.name}
            </button>
          )}
        </div>
        <div className="mt-2 w-full bg-gray-600 rounded-full h-1.5">
          <div
            className="bg-purple-500 h-1.5 rounded-full"
            style={{ width: `${sensorConfig.positionOnBelt * 100}%` }}
          />
        </div>
        <span className="text-gray-500 text-[10px]">{Math.round(sensorConfig.positionOnBelt * 100)}% along belt</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Total Checks</span>
          <span className="text-white font-bold text-sm">{totalChecks}</span>
        </div>
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Fail Rate</span>
          <span className="text-red-400 font-bold text-sm">
            {totalChecks > 0 ? `${((failCount / totalChecks) * 100).toFixed(1)}%` : '-'}
          </span>
        </div>
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Pass</span>
          <span className="text-green-400 font-bold text-sm">{passCount}</span>
        </div>
        <div className="bg-gray-700/50 rounded p-2 text-center">
          <span className="text-gray-400 block">Rework</span>
          <span className="text-amber-400 font-bold text-sm">{reworkCount}</span>
        </div>
      </div>

      {/* Fail probability config */}
      <div className="bg-gray-700/50 rounded p-2 text-xs">
        <span className="text-gray-400">Fail Probability: </span>
        <span className="text-white font-bold">{(sensorConfig.failProbability * 100).toFixed(1)}%</span>
      </div>

      {/* Last trigger */}
      {sensorState?.lastTriggeredAt && (
        <div className="bg-gray-700/50 rounded p-2 text-xs">
          <span className="text-gray-400">Last Trigger: </span>
          <span className="text-white">{formatTime(sensorState.lastTriggeredAt)}</span>
          {sensorState.lastDecision && (
            <span className={`ml-2 font-bold ${DECISION_COLORS[sensorState.lastDecision] ?? 'text-gray-400'}`}>
              {sensorState.lastDecision.toUpperCase()}
            </span>
          )}
          {sensorState.lastPartId && (
            <button
              onClick={() => { selectPart(sensorState.lastPartId!); }}
              className="ml-2 text-blue-400 hover:text-blue-300 font-semibold"
            >
              {shortPartId(sensorState.lastPartId)}
            </button>
          )}
        </div>
      )}

      {/* Recent events */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
          Recent Events ({displayEvents.length})
        </h4>
        {displayEvents.length === 0 ? (
          <p className="text-gray-500 text-xs">No events yet</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-auto">
            {displayEvents.map((evt, i) => (
              <button
                key={`${evt.partId}-${i}`}
                onClick={() => selectPart(evt.partId)}
                className="w-full flex items-center justify-between text-xs bg-gray-700/30 hover:bg-gray-700/60 rounded px-2 py-1.5 transition-colors"
              >
                <span className="text-blue-400 font-semibold">{shortPartId(evt.partId)}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${DECISION_COLORS[evt.decision] ?? 'text-gray-400'}`}>
                    {evt.decision.toUpperCase()}
                  </span>
                  <span className="text-gray-500 text-[10px] font-mono">{formatTime(evt.timestamp)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
