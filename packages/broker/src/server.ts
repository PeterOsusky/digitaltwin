import Aedes from 'aedes';
import { createServer } from 'net';
import mqtt from 'mqtt';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';
import type { WsMessage } from '@digital-twin/shared';
import { getMqttTopics } from '@digital-twin/shared';
import { StateManager } from './state-manager.js';
import { processMessage } from './mqtt-handler.js';

const MQTT_PORT = 1883;
const WS_PORT = 3001;
const ALIVE_CHECK_INTERVAL = 30_000; // check every 30s

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

// 3. Internal MQTT client - subscribe to all station topics (data + isAlive)
const client = mqtt.connect(`mqtt://localhost:${MQTT_PORT}`);

client.on('connect', () => {
  console.log('[broker] Internal MQTT client connected');
  const topics = getMqttTopics();
  for (const topic of topics) {
    client.subscribe(topic, (err) => {
      if (err) console.error(`[broker] Subscribe error for ${topic}:`, err);
      else console.log(`[broker] Subscribed to ${topic}`);
    });
  }
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

  socket.on('close', () => {
    wsClients.delete(socket);
    console.log('[broker] Frontend disconnected');
  });
});

// 5. Bridge: MQTT -> state update -> WS broadcast
client.on('message', (topic, payload) => {
  const wsMsg = processMessage(topic, payload, state);
  if (wsMsg) {
    broadcast(wsMsg);
  }
});

// 6. Periodic alive timeout check
setInterval(() => {
  const offlineMessages = state.checkAliveTimeouts();
  for (const msg of offlineMessages) {
    broadcast(msg);
  }
}, ALIVE_CHECK_INTERVAL);

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
