import { useEffect } from 'react';
import { useStore } from '../store/useStore.ts';
import type { WsMessage } from '../types.ts';

const WS_URL = 'ws://localhost:3001';
const RECONNECT_DELAY = 3000;

let globalWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
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
      case 'station_update':
        s.handleStationUpdate(msg.data);
        break;
      case 'station_status':
        s.handleStationStatus(msg.data);
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
