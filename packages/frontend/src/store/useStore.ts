import { create } from 'zustand';
import type { StationState, FactoryLayout } from '../types.ts';

interface AppStore {
  connected: boolean;
  setConnected: (v: boolean) => void;

  layout: FactoryLayout | null;
  stations: Map<string, StationState>;

  handleInit: (data: { layout: FactoryLayout; stations: Record<string, StationState> }) => void;
  handleStationUpdate: (data: { stationId: string; value: Record<string, unknown>; timestamp: string }) => void;
  handleStationStatus: (data: { stationId: string; status: 'online' | 'offline' }) => void;
}

export const useStore = create<AppStore>((set) => ({
  connected: false,
  setConnected: (v) => set({ connected: v }),

  layout: null,
  stations: new Map(),

  handleInit: (data) => {
    const stations = new Map<string, StationState>();
    for (const [id, s] of Object.entries(data.stations)) {
      stations.set(id, s);
    }
    set({ layout: data.layout, stations });
  },

  handleStationUpdate: (data) => {
    set((state) => {
      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, {
          ...station,
          lastValue: data.value,
          lastUpdated: data.timestamp,
        });
      }
      return { stations };
    });
  },

  handleStationStatus: (data) => {
    set((state) => {
      const stations = new Map(state.stations);
      const station = stations.get(data.stationId);
      if (station) {
        stations.set(data.stationId, {
          ...station,
          status: data.status,
        });
      }
      return { stations };
    });
  },
}));
