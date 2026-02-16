import mqtt from 'mqtt';
import { FactorySimulator } from './factory-simulator.js';

const MQTT_URL = 'mqtt://localhost:1883';

console.log('[simulator] Connecting to MQTT broker...');
const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
  console.log('[simulator] Connected to MQTT broker');
  const simulator = new FactorySimulator(client);
  simulator.start();

  process.on('SIGINT', () => {
    console.log('[simulator] Shutting down...');
    simulator.stop();
    client.end();
    process.exit(0);
  });
});

client.on('error', (err) => {
  console.error('[simulator] MQTT connection error:', err.message);
  console.log('[simulator] Retrying in 3s... (is the broker running?)');
});
