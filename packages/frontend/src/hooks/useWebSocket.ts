import { useEffect } from 'react';
import { useStore } from '../store/useStore.ts';
import { pushMetric, flushMetrics, getTotalReceived, getTopicCount } from '../store/metricBuffer.ts';
import { recordFlush } from '../store/perfStats.ts';
import type { WsMessage } from '../types.ts';

const WS_URL = 'ws://localhost:3001';
const RECONNECT_DELAY = 3000;
const METRIC_FLUSH_INTERVAL = 500; // ms

// Singleton WS — only one connection at a time
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let isConnecting = false;

function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (globalWs) {
    globalWs.onopen = null;
    globalWs.onclose = null;
    globalWs.onerror = null;
    globalWs.onmessage = null;
    globalWs.close();
    globalWs = null;
  }
  isConnecting = false;
}

function startMetricFlushLoop() {
  if (flushTimer) return; // Already running
  flushTimer = setInterval(() => {
    const batch = flushMetrics();
    if (batch.length === 0) return;

    const t0 = performance.now();
    useStore.getState().handleMetricFlush(batch);
    const dt = performance.now() - t0;

    const uniqueStations = new Set(batch.map(m => m.stationId)).size;
    recordFlush(batch.length, uniqueStations, dt, getTotalReceived(), getTopicCount());

    if (batch.length > 50) {
      console.log(`[perf] metric flush: ${batch.length} metrics (${uniqueStations} stations), store update: ${dt.toFixed(1)}ms`);
    }
  }, METRIC_FLUSH_INTERVAL);
}

function startConnection() {
  if (isConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
    return;
  }

  cleanup();
  isConnecting = true;

  const ws = new WebSocket(WS_URL);
  globalWs = ws;

  ws.onopen = () => {
    console.log('[ws] Connected to backend');
    isConnecting = false;
    useStore.getState().setConnected(true);
    startMetricFlushLoop();
  };

  ws.onclose = () => {
    console.log('[ws] Disconnected, reconnecting...');
    globalWs = null;
    isConnecting = false;
    useStore.getState().setConnected(false);
    reconnectTimer = setTimeout(startConnection, RECONNECT_DELAY);
  };

  ws.onerror = () => {
    ws.close();
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data) as WsMessage;
    const s = useStore.getState();

    switch (msg.type) {
      case 'init':
        s.handleInit(msg.data);
        break;
      case 'part_enter':
        s.handlePartEnter(msg.data);
        break;
      case 'part_exit':
        s.handlePartExit(msg.data);
        break;
      case 'part_process':
        s.handlePartProcess(msg.data);
        break;
      case 'station_status':
        s.handleStationStatus(msg.data);
        break;
      case 'metric_update':
        // Push to FE buffer — flushed into Zustand every 500ms
        pushMetric(msg.data);
        break;
      case 'transit_start':
        s.handleTransitStart(msg.data);
        break;
      case 'transit_stop':
        s.handleTransitStop(msg.data);
        break;
      case 'sensor_trigger':
        s.handleSensorTrigger(msg.data);
        break;
    }
  };
}

export function useWebSocket() {
  useEffect(() => {
    startConnection();
    return () => {};
  }, []);
}
