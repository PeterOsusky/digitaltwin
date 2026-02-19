import { create } from 'zustand';
import type { Part, StationState, FactoryLayout, LiveEvent, ExitResult, StationStatus, TransitPart, SensorState, SensorDecision } from '../types.ts';

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
  connected: boolean;
  setConnected: (v: boolean) => void;

  layout: FactoryLayout | null;
  setLayout: (layout: FactoryLayout) => void;

  parts: Map<string, Part>;
  selectedPartId: string | null;
  selectPart: (partId: string | null) => void;

  stations: Map<string, StationState>;
  selectedStationId: string | null;
  selectStation: (stationId: string | null) => void;

  transitParts: Map<string, TransitPart>;

  sensors: Map<string, SensorState>;
  selectedSensorId: string | null;
  selectSensor: (sensorId: string | null) => void;

  events: LiveEvent[];

  // Actions from WebSocket messages
  handleInit: (data: { parts: Part[]; layout: FactoryLayout; stations: Record<string, StationState>; sensors: Record<string, SensorState> }) => void;
  handlePartEnter: (data: { partId: string; stationId: string; area: string; line: string; timestamp: string }) => void;
  handlePartExit: (data: { partId: string; stationId: string; area: string; line: string; timestamp: string; result: ExitResult; cycleTimeMs: number }) => void;
  handlePartProcess: (data: { partId: string; stationId: string; progressPct: number }) => void;
  handleStationStatus: (data: { stationId: string; status: StationStatus; currentPartId: string | null }) => void;
  handleMetricFlush: (data: Array<{ stationId: string; metric: string; value: number; unit: string }>) => void;
  handleTransitStart: (data: { partId: string; fromStationId: string; toStationId: string; transitTimeMs: number; timestamp: string }) => void;
  handleTransitStop: (data: { partId: string; fromStationId: string; toStationId: string; reason: string; timestamp: string }) => void;
  handleSensorTrigger: (data: { sensorId: string; partId: string; type: string; decision: SensorDecision; timestamp: string; fromStationId: string; toStationId: string }) => void;

  // Computed
  getActiveParts: () => Part[];
  getCompletedParts: () => Part[];
  getErrorCount: () => number;
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
      parts.set(p.partId, { ...p, progressPct: p.progressPct ?? 0 });
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
          progressPct: 0,
        };
      } else if (part.status === 'completed' || part.status === 'scrapped') {
        return {};
      } else {
        part = { ...part, status: 'in_station', currentStation: data.stationId, currentArea: data.area, currentLine: data.line, progressPct: 0 };
      }
      parts.set(data.partId, part);

      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, { ...station, status: 'running', currentPartId: data.partId });
      }

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
        return {};
      }
      if (part) {
        const stationConfig = state.layout?.stations[data.stationId];
        let status = part.status;
        if (data.result === 'nok') status = 'scrapped';
        else if (stationConfig && stationConfig.nextStations.length === 0 && data.result === 'ok') status = 'completed';
        else status = 'in_transit';

        parts.set(data.partId, { ...part, status, currentStation: null, progressPct: 100 });
      }

      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        const counters = { ...(station.counters ?? { ok: 0, nok: 0, rework: 0 }) };
        if (data.result === 'ok') counters.ok++;
        else if (data.result === 'nok') counters.nok++;
        else if (data.result === 'rework') counters.rework++;
        stations.set(data.stationId, { ...station, status: 'idle', currentPartId: null, counters });
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
        parts.set(data.partId, { ...part, progressPct: data.progressPct });
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

  // FE-side batch flush — single set() for all buffered metrics
  handleMetricFlush: (data) => {
    set((state) => {
      const stations = new Map(state.stations);

      for (const item of data) {
        const station = stations.get(item.stationId);
        if (!station) continue; // Skip virtual stations not in layout

        const metrics = { ...station.metrics };
        if (item.metric === 'temperature') metrics.temperature = item.value;
        else if (item.metric === 'cycle_time') metrics.cycleTime = item.value;
        else if (item.metric === 'output_count') metrics.outputCount = item.value;

        stations.set(item.stationId, { ...station, metrics });
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

      // Update part status on sensor fail
      const parts = new Map(state.parts);
      const part = parts.get(data.partId);
      if (part && data.decision === 'fail') {
        parts.set(data.partId, { ...part, status: 'scrapped' });
      }

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

      return { parts, sensors, events };
    });
  },

  getActiveParts: () => [...get().parts.values()].filter(p => p.status === 'in_station' || p.status === 'in_transit'),
  getCompletedParts: () => [...get().parts.values()].filter(p => p.status === 'completed'),
  getErrorCount: () => [...get().parts.values()].filter(p => p.status === 'scrapped').length,

  getStats: () => {
    const allParts = [...get().parts.values()];
    const stations = get().stations;

    const activeParts = allParts.filter(p => p.status === 'in_station' || p.status === 'in_transit').length;
    const completedParts = allParts.filter(p => p.status === 'completed').length;
    const scrappedParts = allParts.filter(p => p.status === 'scrapped').length;
    const runningStations = [...stations.values()].filter(s => s.status === 'running').length;
    const totalStations = stations.size;

    // Avg cycle time from station counters — use last cycle time from each station
    const cycleTimes: number[] = [];
    for (const s of stations.values()) {
      if (s.metrics.cycleTime != null) cycleTimes.push(s.metrics.cycleTime);
    }
    const avgCycleTimeMs = cycleTimes.length > 0
      ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
      : 0;

    // Rework rate from station counters
    let totalOk = 0, totalNok = 0, totalRework = 0;
    for (const s of stations.values()) {
      if (s.counters) {
        totalOk += s.counters.ok;
        totalNok += s.counters.nok;
        totalRework += s.counters.rework;
      }
    }
    const totalExits = totalOk + totalNok + totalRework;
    const reworkRate = totalExits > 0 ? (totalRework / totalExits) * 100 : 0;

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
