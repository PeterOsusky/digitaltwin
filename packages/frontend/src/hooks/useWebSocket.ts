import { useEffect } from 'react';
import { useStore } from '../store/useStore.ts';
import type { WsMessage } from '../types.ts';

const WS_URL = 'ws://localhost:3001';
const RECONNECT_DELAY = 3000;

// Singleton WS — only one connection at a time
let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;

export function sendWsMessage(msg: Record<string, unknown>) {
  if (globalWs && globalWs.readyState === WebSocket.OPEN) {
    globalWs.send(JSON.stringify(msg));
  }
}

function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (globalWs) {
    // Remove all listeners before closing to prevent reconnect from onclose
    globalWs.onopen = null;
    globalWs.onclose = null;
    globalWs.onerror = null;
    globalWs.onmessage = null;
    globalWs.close();
    globalWs = null;
  }
  isConnecting = false;
}

function startConnection() {
  if (isConnecting || (globalWs && globalWs.readyState === WebSocket.OPEN)) {
    return; // Already connected or connecting
  }

  cleanup();
  isConnecting = true;

  const store = useStore.getState();

  const ws = new WebSocket(WS_URL);
  globalWs = ws;

  ws.onopen = () => {
    console.log('[ws] Connected to backend');
    isConnecting = false;
    useStore.getState().setConnected(true);
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
        s.handleMetricUpdate(msg.data);
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
      case 'part_override':
        s.handlePartOverride(msg.data);
        break;
    }
  };
}

export function useWebSocket() {
  useEffect(() => {
    startConnection();

    // Cleanup only on full unmount (not on HMR re-render)
    return () => {
      // Don't cleanup on HMR — we want to keep the singleton alive
      // Only cleanup on actual app unmount
    };
  }, []);
}
