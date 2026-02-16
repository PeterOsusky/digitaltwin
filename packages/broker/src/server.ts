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
        const now = new Date().toISOString();
        const overrideMsg: WsMessage = {
          type: 'part_override',
          data: { partId: req.partId, timestamp: now },
        };
        broadcast(overrideMsg);
        console.log(`[broker] Part ${req.partId} manually overridden to continue`);

        // Resume: simulate the part continuing through remaining stations + sensors
        const fromId = req.fromStationId;
        const toId = req.toStationId;
        if (fromId && toId) {
          simulatePartResume(req.partId, fromId, toId, req.failedSensorId);
        }
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

// 6. Override resume: simulate part continuing through remaining sensors + stations
function simulatePartResume(partId: string, fromStationId: string, toStationId: string, failedSensorId?: string) {
  const { stations, sensors } = state.layout;

  const toStation = stations[toStationId];
  if (!toStation) return;

  const lineConfig = state.layout.areas
    .flatMap(a => a.lines)
    .find(l => l.stations.includes(toStationId));
  if (!lineConfig) return;

  let delay = 0;

  // Step 1: Evaluate remaining sensors on the CURRENT belt (from→to)
  // Get sensors on this belt segment, sorted by position
  const beltSensors = sensors
    .filter(s => s.fromStationId === fromStationId && s.toStationId === toStationId)
    .sort((a, b) => a.positionOnBelt - b.positionOnBelt);

  // Find sensors AFTER the failed one
  let remainingSensors = beltSensors;
  if (failedSensorId) {
    const failIdx = beltSensors.findIndex(s => s.sensorId === failedSensorId);
    if (failIdx >= 0) {
      remainingSensors = beltSensors.slice(failIdx + 1);
    }
  }

  // Override = operator confirmed part is OK → all remaining sensors pass
  for (const sensor of remainingSensors) {
    delay += 800;
    const sensorDelay = delay;
    setTimeout(() => {
      client.publish(
        `factory/${toStation.area}/${toStation.line}/sensor/${sensor.sensorId}/trigger`,
        JSON.stringify({
          sensorId: sensor.sensorId, partId, type: sensor.type,
          decision: 'pass', timestamp: new Date().toISOString(),
          fromStationId, toStationId,
        }),
      );
    }, sensorDelay);
  }

  // Step 2: Transit to destination station (after sensors)
  delay += 500;
  const transitTime = 3000;
  const transitDelay1 = delay;
  setTimeout(() => {
    client.publish(
      `factory/${toStation.area}/${toStation.line}/transit/start`,
      JSON.stringify({
        partId, fromStationId, toStationId,
        transitTimeMs: transitTime, timestamp: new Date().toISOString(),
      }),
    );
  }, transitDelay1);
  delay += transitTime;

  // Step 3: Process remaining stations (from toStation onward)
  const toIdx = lineConfig.stations.indexOf(toStationId);
  const remaining = lineConfig.stations.slice(toIdx);

  for (let i = 0; i < remaining.length; i++) {
    const sid = remaining[i];
    const sc = stations[sid];
    if (!sc) continue;

    const [minTime, maxTime] = sc.processingTime;
    const procTime = Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;

    // Enter station
    const enterDelay = delay;
    setTimeout(() => {
      client.publish(
        `factory/${sc.area}/${sc.line}/${sid}/part/enter`,
        JSON.stringify({
          partId, timestamp: new Date().toISOString(),
          stationId: sid, area: sc.area, line: sc.line,
        }),
      );
    }, enterDelay);

    // Progress updates
    const steps = Math.floor(procTime / 2000);
    for (let s = 1; s <= steps; s++) {
      const progressDelay = enterDelay + s * 2000;
      const pct = Math.min(99, Math.round((s / steps) * 100));
      setTimeout(() => {
        client.publish(
          `factory/${sc.area}/${sc.line}/${sid}/part/process`,
          JSON.stringify({ partId, timestamp: new Date().toISOString(), stationId: sid, progressPct: pct }),
        );
      }, progressDelay);
    }

    delay += procTime;

    // Exit station (always OK for overridden parts)
    const exitDelay = delay;
    setTimeout(() => {
      client.publish(
        `factory/${sc.area}/${sc.line}/${sid}/part/exit`,
        JSON.stringify({
          partId, timestamp: new Date().toISOString(),
          stationId: sid, area: sc.area, line: sc.line,
          result: 'ok', cycleTimeMs: procTime,
        }),
      );
    }, exitDelay);

    // Transit + sensors to next station (if not last)
    if (i < remaining.length - 1) {
      const nextSid = remaining[i + 1];
      const nextSc = stations[nextSid];
      if (!nextSc) continue;

      // Sensors on belt between current and next station (all pass for override)
      const nextBeltSensors = sensors
        .filter(s => s.fromStationId === sid && s.toStationId === nextSid)
        .sort((a, b) => a.positionOnBelt - b.positionOnBelt);

      delay += 100;
      const tDelay = delay;
      setTimeout(() => {
        client.publish(
          `factory/${nextSc.area}/${nextSc.line}/transit/start`,
          JSON.stringify({
            partId, fromStationId: sid, toStationId: nextSid,
            transitTimeMs: transitTime, timestamp: new Date().toISOString(),
          }),
        );
      }, tDelay);

      // Sensor triggers during transit (all pass)
      for (const sensor of nextBeltSensors) {
        delay += 600;
        const sd = delay;
        setTimeout(() => {
          client.publish(
            `factory/${nextSc.area}/${nextSc.line}/sensor/${sensor.sensorId}/trigger`,
            JSON.stringify({
              sensorId: sensor.sensorId, partId, type: sensor.type,
              decision: 'pass', timestamp: new Date().toISOString(),
              fromStationId: sid, toStationId: nextSid,
            }),
          );
        }, sd);
      }

      delay += transitTime;
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
