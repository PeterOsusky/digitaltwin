import Aedes from 'aedes';
import { createServer } from 'net';
import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { WsMessage, WsRequest } from '@digital-twin/shared';
import { StateManager } from './state-manager.js';
import { processMessage } from './mqtt-handler.js';

const MQTT_PORT = 1883;
const WS_PORT = 3001;

// 1. Create Aedes MQTT broker
const aedes = new Aedes();
const mqttServer = createServer(aedes.handle);

mqttServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[broker] Port ${MQTT_PORT} is already in use. Kill the other process and retry.`);
    process.exit(1);
  }
  throw err;
});

mqttServer.listen(MQTT_PORT, () => {
  console.log(`[broker] MQTT broker running on port ${MQTT_PORT}`);
});

// 2. State manager
const state = new StateManager();

// 3. Internal MQTT client - subscribe to all factory topics
const client = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`);

client.on('connect', () => {
  console.log('[broker] Internal MQTT client connected');
  client.subscribe('factory/#', (err) => {
    if (err) console.error('[broker] Subscribe error:', err);
    else console.log('[broker] Subscribed to factory/#');
  });
});

// 4. WebSocket server for frontend
const wss = new WebSocketServer({ port: WS_PORT });
const wsClients = new Set<WebSocket>();

wss.on('listening', () => {
  console.log(`[broker] WebSocket server running on port ${WS_PORT}`);
});

wss.on('connection', (socket) => {
  console.log('[broker] Frontend connected via WebSocket');
  wsClients.add(socket);

  // Send full state on connect
  const initMsg: WsMessage = { type: 'init', data: state.getInitData() };
  socket.send(JSON.stringify(initMsg));

  socket.on('message', (raw) => {
    try {
      const req = JSON.parse(raw.toString()) as WsRequest;
      handleWsRequest(socket, req);
    } catch (e) {
      console.error('[broker] Invalid WS message:', e);
    }
  });

  socket.on('close', () => {
    wsClients.delete(socket);
    console.log('[broker] Frontend disconnected');
  });
});

function handleWsRequest(socket: WebSocket, req: WsRequest) {
  switch (req.type) {
    case 'get_part_history': {
      const part = state.parts.get(req.partId) ?? null;
      socket.send(JSON.stringify({ type: 'part_history', data: part }));
      break;
    }
    case 'search_part': {
      const results = state.searchParts(req.query);
      socket.send(JSON.stringify({ type: 'search_results', data: results }));
      break;
    }
    case 'override_part': {
      const part = state.handlePartOverride(req.partId);
      if (part) {
        const overrideMsg: WsMessage = {
          type: 'part_override',
          data: { partId: req.partId, timestamp: new Date().toISOString() },
        };
        broadcast(overrideMsg);
        console.log(`[broker] Part ${req.partId} manually overridden to continue`);
      }
      break;
    }
  }
}

// 5. Bridge: MQTT -> state update -> WS broadcast
client.on('message', (topic, payload) => {
  const wsMsg = processMessage(topic, payload, state);
  if (wsMsg) {
    broadcast(wsMsg);
  }
});

function broadcast(msg: WsMessage) {
  const json = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === 1) { // OPEN
      client.send(json);
    }
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[broker] Shutting down...');
  client.end();
  aedes.close(() => {
    mqttServer.close();
    wss.close();
    process.exit(0);
  });
});
