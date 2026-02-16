import { create } from 'zustand';
import type { Part, PartSensorEvent, StationState, FactoryLayout, LiveEvent, ExitResult, StationStatus, TransitPart, SensorState, SensorDecision } from '../types.ts';

let eventCounter = 0;
let initTimestamp: number | null = null;

export interface StatsData {
  activeParts: number;
  completedParts: number;
  scrappedParts: number;
  runningStations: number;
  totalStations: number;
  avgCycleTimeMs: number;
  reworkRate: number;
  throughputPerMin: number;
}

interface AppStore {
  // Connection
  connected: boolean;
  setConnected: (v: boolean) => void;

  // Factory layout
  layout: FactoryLayout | null;
  setLayout: (layout: FactoryLayout) => void;

  // Parts
  parts: Map<string, Part>;
  selectedPartId: string | null;
  selectPart: (partId: string | null) => void;

  // Stations
  stations: Map<string, StationState>;
  selectedStationId: string | null;
  selectStation: (stationId: string | null) => void;

  // Transit parts
  transitParts: Map<string, TransitPart>;

  // Sensors
  sensors: Map<string, SensorState>;
  selectedSensorId: string | null;
  selectSensor: (sensorId: string | null) => void;

  // Live events
  events: LiveEvent[];

  // Actions from WebSocket messages
  handleInit: (data: { parts: Part[]; layout: FactoryLayout; stations: Record<string, StationState>; sensors: Record<string, SensorState> }) => void;
  handlePartEnter: (data: { partId: string; stationId: string; area: string; line: string; timestamp: string }) => void;
  handlePartExit: (data: { partId: string; stationId: string; area: string; line: string; timestamp: string; result: ExitResult; cycleTimeMs: number }) => void;
  handlePartProcess: (data: { partId: string; stationId: string; progressPct: number }) => void;
  handleStationStatus: (data: { stationId: string; status: StationStatus; currentPartId: string | null }) => void;
  handleMetricUpdate: (data: { stationId: string; metric: string; value: number }) => void;
  handleTransitStart: (data: { partId: string; fromStationId: string; toStationId: string; transitTimeMs: number; timestamp: string }) => void;
  handleTransitStop: (data: { partId: string; fromStationId: string; toStationId: string; reason: string; timestamp: string }) => void;
  handleSensorTrigger: (data: { sensorId: string; partId: string; type: string; decision: SensorDecision; timestamp: string; fromStationId: string; toStationId: string }) => void;
  handlePartOverride: (data: { partId: string; timestamp: string }) => void;

  // Computed
  getActiveParts: () => Part[];
  getCompletedParts: () => Part[];
  getErrorCount: () => number;
  getStationHistory: (stationId: string) => Part[];
  getStats: () => StatsData;
}

function addEvent(events: LiveEvent[], event: Omit<LiveEvent, 'id'>): LiveEvent[] {
  const newEvent = { ...event, id: String(++eventCounter) };
  return [newEvent, ...events].slice(0, 100);
}

export const useStore = create<AppStore>((set, get) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  layout: null,
  setLayout: (layout) => set({ layout }),

  parts: new Map(),
  selectedPartId: null,
  selectPart: (partId) => set({ selectedPartId: partId }),

  stations: new Map(),
  selectedStationId: null,
  selectStation: (stationId) => set({ selectedStationId: stationId }),

  transitParts: new Map(),
  sensors: new Map(),
  selectedSensorId: null,
  selectSensor: (sensorId) => set({ selectedSensorId: sensorId }),
  events: [],

  handleInit: (data) => {
    initTimestamp = Date.now();
    const parts = new Map<string, Part>();
    for (const p of data.parts) {
      parts.set(p.partId, { ...p, sensorEvents: p.sensorEvents ?? [] });
    }
    const stations = new Map<string, StationState>();
    for (const [id, s] of Object.entries(data.stations)) {
      stations.set(id, s);
    }
    const sensors = new Map<string, SensorState>();
    if (data.sensors) {
      for (const [id, s] of Object.entries(data.sensors)) {
        sensors.set(id, s);
      }
    }
    set({ parts, stations, sensors, layout: data.layout, events: [], transitParts: new Map() });
  },

  handlePartEnter: (data) => {
    set((state) => {
      const parts = new Map(state.parts);
      let part = parts.get(data.partId);
      if (!part) {
        part = {
          partId: data.partId,
          createdAt: data.timestamp,
          status: 'in_station',
          currentStation: data.stationId,
          currentArea: data.area,
          currentLine: data.line,
          history: [],
          sensorEvents: [],
        };
      } else if (part.status === 'completed' || part.status === 'scrapped') {
        // Completed/scrapped parts must NEVER re-enter production
        return {};
      } else {
        part = { ...part, status: 'in_station', currentStation: data.stationId, currentArea: data.area, currentLine: data.line };
      }
      // Idempotency: skip if this exact enter already exists (prevents duplicates on reconnect)
      const alreadyExists = part.history.some(
        h => h.stationId === data.stationId && h.enteredAt === data.timestamp,
      );
      if (!alreadyExists) {
        part.history = [...part.history, {
          stationId: data.stationId,
          area: data.area,
          line: data.line,
          enteredAt: data.timestamp,
          exitedAt: null,
          result: null,
          cycleTimeMs: null,
          progressPct: 0,
        }];
      }
      parts.set(data.partId, part);

      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, { ...station, status: 'running', currentPartId: data.partId });
      }

      // Remove transit part (it arrived at its destination)
      const transitParts = new Map(state.transitParts);
      transitParts.delete(data.partId);

      const stationName = state.layout?.stations[data.stationId]?.name ?? data.stationId;
      const displayId = state.layout?.stations[data.stationId]?.displayId ?? '';
      const events = addEvent(state.events, {
        type: 'part_enter',
        message: `${data.partId} entered #${displayId} ${stationName}`,
        timestamp: data.timestamp,
        partId: data.partId,
        stationId: data.stationId,
      });

      return { parts, stations, events, transitParts };
    });
  },

  handlePartExit: (data) => {
    set((state) => {
      const parts = new Map(state.parts);
      const part = parts.get(data.partId);
      if (part && (part.status === 'completed' || part.status === 'scrapped')) {
        return {}; // Completed/scrapped parts cannot exit again
      }
      if (part) {
        const history = [...part.history];
        // Find matching entry by stationId (may not be last if next enter arrived first)
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].stationId === data.stationId && !history[i].exitedAt) {
            history[i] = { ...history[i], exitedAt: data.timestamp, result: data.result, cycleTimeMs: data.cycleTimeMs, progressPct: 100 };
            break;
          }
        }

        const stationConfig = state.layout?.stations[data.stationId];
        let status = part.status;
        if (data.result === 'nok') status = 'scrapped';
        else if (stationConfig && stationConfig.nextStations.length === 0 && data.result === 'ok') status = 'completed';
        else status = 'in_transit';

        parts.set(data.partId, { ...part, history, status, currentStation: null });
      }

      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, { ...station, status: 'idle', currentPartId: null });
      }

      const stationName = state.layout?.stations[data.stationId]?.name ?? data.stationId;
      const displayId = state.layout?.stations[data.stationId]?.displayId ?? '';
      const resultLabel = data.result === 'ok' ? 'OK' : data.result === 'rework' ? 'REWORK' : 'NOK';
      const events = addEvent(state.events, {
        type: data.result === 'nok' ? 'error' : 'part_exit',
        message: `${data.partId} exited #${displayId} ${stationName} [${resultLabel}]`,
        timestamp: data.timestamp,
        partId: data.partId,
        stationId: data.stationId,
        result: data.result,
      });

      return { parts, stations, events };
    });
  },

  handlePartProcess: (data) => {
    set((state) => {
      const parts = new Map(state.parts);
      const part = parts.get(data.partId);
      if (part) {
        const history = [...part.history];
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].stationId === data.stationId && !history[i].exitedAt) {
            history[i] = { ...history[i], progressPct: data.progressPct };
            break;
          }
        }
        parts.set(data.partId, { ...part, history });
      }
      return { parts };
    });
  },

  handleStationStatus: (data) => {
    set((state) => {
      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, { ...station, status: data.status, currentPartId: data.currentPartId });
      }

      if (data.status === 'error') {
        const stationName = state.layout?.stations[data.stationId]?.name ?? data.stationId;
        const displayId = state.layout?.stations[data.stationId]?.displayId ?? '';
        const events = addEvent(state.events, {
          type: 'error',
          message: `#${displayId} ${stationName} reported ERROR`,
          timestamp: new Date().toISOString(),
          stationId: data.stationId,
        });
        return { stations, events };
      }

      return { stations };
    });
  },

  handleMetricUpdate: (data) => {
    set((state) => {
      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        const metrics = { ...station.metrics };
        if (data.metric === 'temperature') metrics.temperature = data.value;
        else if (data.metric === 'cycle_time') metrics.cycleTime = data.value;
        else if (data.metric === 'output_count') metrics.outputCount = data.value;
        stations.set(data.stationId, { ...station, metrics });
      }
      return { stations };
    });
  },

  handleTransitStart: (data) => {
    set((state) => {
      const transitParts = new Map(state.transitParts);
      transitParts.set(data.partId, {
        partId: data.partId,
        fromStationId: data.fromStationId,
        toStationId: data.toStationId,
        startedAt: Date.now(),
        transitTimeMs: data.transitTimeMs,
        stopped: false,
      });
      return { transitParts };
    });
  },

  handleTransitStop: (data) => {
    set((state) => {
      const transitParts = new Map(state.transitParts);
      const transit = transitParts.get(data.partId);
      if (transit) {
        transitParts.set(data.partId, { ...transit, stopped: true });
      }
      return { transitParts };
    });
  },

  handleSensorTrigger: (data) => {
    set((state) => {
      const sensors = new Map(state.sensors);
      sensors.set(data.sensorId, {
        sensorId: data.sensorId,
        lastTriggeredAt: data.timestamp,
        lastDecision: data.decision,
        lastPartId: data.partId,
        isActive: true,
      });

      // Record sensor event on the part (with idempotency)
      const parts = new Map(state.parts);
      const part = parts.get(data.partId);
      if (part) {
        const existing = part.sensorEvents ?? [];
        const alreadyExists = existing.some(
          se => se.sensorId === data.sensorId && se.timestamp === data.timestamp,
        );

        if (!alreadyExists) {
          const sensorEvent: PartSensorEvent = {
            sensorId: data.sensorId,
            type: data.type as PartSensorEvent['type'],
            decision: data.decision,
            timestamp: data.timestamp,
            fromStationId: data.fromStationId,
            toStationId: data.toStationId,
          };
          const sensorEvents = [...existing, sensorEvent];

          let status = part.status;
          if (data.decision === 'fail') status = 'scrapped';

          parts.set(data.partId, { ...part, sensorEvents, status });
        }
      }

      // Find sensor displayId from layout
      const sensorConfig = state.layout?.sensors.find(s => s.sensorId === data.sensorId);
      const sensorLabel = sensorConfig?.displayId ?? data.sensorId;

      let events = state.events;

      if (data.decision === 'fail') {
        events = addEvent(events, {
          type: 'error',
          message: `Sensor ${sensorLabel} FAILED - part stopped`,
          timestamp: data.timestamp,
          partId: data.partId,
        });
      } else if (data.decision === 'rework') {
        events = addEvent(events, {
          type: 'sensor',
          message: `Sensor ${sensorLabel} triggered REWORK for ${data.partId}`,
          timestamp: data.timestamp,
          partId: data.partId,
        });
      } else if (data.decision === 'skip_process') {
        events = addEvent(events, {
          type: 'sensor',
          message: `Sensor ${sensorLabel} SKIP PROCESS for ${data.partId}`,
          timestamp: data.timestamp,
          partId: data.partId,
        });
      }
      // 'pass' - don't add event (too noisy)

      return { parts, sensors, events };
    });
  },

  handlePartOverride: (data) => {
    set((state) => {
      const parts = new Map(state.parts);
      const part = parts.get(data.partId);
      if (part) {
        parts.set(data.partId, { ...part, status: 'in_transit' });
      }
      // Remove stopped transit
      const transitParts = new Map(state.transitParts);
      transitParts.delete(data.partId);

      const events = addEvent(state.events, {
        type: 'part_enter',
        message: `${data.partId} manually overridden → OK`,
        timestamp: data.timestamp,
        partId: data.partId,
      });

      return { parts, transitParts, events };
    });
  },

  getActiveParts: () => [...get().parts.values()].filter(p => p.status === 'in_station' || p.status === 'in_transit'),
  getCompletedParts: () => [...get().parts.values()].filter(p => p.status === 'completed'),
  getErrorCount: () => [...get().parts.values()].filter(p => p.status === 'scrapped').length,

  getStationHistory: (stationId: string) => {
    const allParts = [...get().parts.values()];
    return allParts
      .filter(p => p.history.some(h => h.stationId === stationId))
      .sort((a, b) => {
        const aEntry = [...a.history].reverse().find(h => h.stationId === stationId);
        const bEntry = [...b.history].reverse().find(h => h.stationId === stationId);
        return (bEntry?.enteredAt ?? '').localeCompare(aEntry?.enteredAt ?? '');
      })
      .slice(0, 50);
  },

  getStats: () => {
    const allParts = [...get().parts.values()];
    const stations = get().stations;

    const activeParts = allParts.filter(p => p.status === 'in_station' || p.status === 'in_transit').length;
    const completedParts = allParts.filter(p => p.status === 'completed').length;
    const scrappedParts = allParts.filter(p => p.status === 'scrapped').length;
    const runningStations = [...stations.values()].filter(s => s.status === 'running').length;
    const totalStations = stations.size;

    // Average cycle time from all completed history entries
    const cycleTimes: number[] = [];
    for (const p of allParts) {
      for (const h of p.history) {
        if (h.cycleTimeMs != null) cycleTimes.push(h.cycleTimeMs);
      }
    }
    const avgCycleTimeMs = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

    // Rework rate: parts with at least 1 rework result / total parts
    const partsWithRework = allParts.filter(p => p.history.some(h => h.result === 'rework')).length;
    const reworkRate = allParts.length > 0 ? (partsWithRework / allParts.length) * 100 : 0;

    // Throughput: completed parts per minute since init
    const elapsedMinutes = initTimestamp ? (Date.now() - initTimestamp) / 60000 : 0;
    const throughputPerMin = elapsedMinutes > 0.5 ? completedParts / elapsedMinutes : 0;

    return {
      activeParts,
      completedParts,
      scrappedParts,
      runningStations,
      totalStations,
      avgCycleTimeMs,
      reworkRate,
      throughputPerMin,
    };
  },
}));
