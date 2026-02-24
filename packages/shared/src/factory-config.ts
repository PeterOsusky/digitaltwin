import type { FactoryLayout, StationConfig, AreaConfig } from './types.js';

// ---- Manualne definovane stanice ----
// Na pridanie novej stanice:
//   1. Pridat objekt do STATIONS[] s unikatnym stationId
//   2. Pridat stationId do prislusnej area v AREAS[]
//   3. Nastavit nextStations[] pre belt spojenia
//   4. (Volitelne) Pridat novu area do AREAS[]

const STATIONS: StationConfig[] = [
  // ===== VYROBA (Production) =====
  {
    stationId: 'station-1',
    name: 'Vyroba 1',
    area: 'vyroba',
    mqttTopic: 'factory/station1/data',
    isAliveTopic: 'factory/station1/isalive',
    position: { x: 160, y: 120 },
    nextStations: ['station-2'],
  },
  {
    stationId: 'station-2',
    name: 'Vyroba 2',
    area: 'vyroba',
    mqttTopic: 'factory/station2/data',
    isAliveTopic: 'factory/station2/isalive',
    position: { x: 430, y: 120 },
    nextStations: ['station-3'],
  },
  {
    stationId: 'station-3',
    name: 'Vyroba 3',
    area: 'vyroba',
    mqttTopic: 'factory/station3/data',
    isAliveTopic: 'factory/station3/isalive',
    position: { x: 700, y: 120 },
    nextStations: [],
  },

  // ===== MONTAZ (Assembly) =====
  {
    stationId: 'station-4',
    name: 'Montaz 1',
    area: 'montaz',
    mqttTopic: 'factory/station4/data',
    isAliveTopic: 'factory/station4/isalive',
    position: { x: 160, y: 320 },
    nextStations: ['station-5'],
  },
  {
    stationId: 'station-5',
    name: 'Montaz 2',
    area: 'montaz',
    mqttTopic: 'factory/station5/data',
    isAliveTopic: 'factory/station5/isalive',
    position: { x: 430, y: 320 },
    nextStations: ['station-6'],
  },
  {
    stationId: 'station-6',
    name: 'Montaz 3',
    area: 'montaz',
    mqttTopic: 'factory/station6/data',
    isAliveTopic: 'factory/station6/isalive',
    position: { x: 700, y: 320 },
    nextStations: [],
  },

  // ===== KONTROLA (Quality Control) =====
  {
    stationId: 'station-7',
    name: 'Kontrola 1',
    area: 'kontrola',
    mqttTopic: 'factory/station7/data',
    isAliveTopic: 'factory/station7/isalive',
    position: { x: 160, y: 520 },
    nextStations: ['station-8'],
  },
  {
    stationId: 'station-8',
    name: 'Kontrola 2',
    area: 'kontrola',
    mqttTopic: 'factory/station8/data',
    isAliveTopic: 'factory/station8/isalive',
    position: { x: 430, y: 520 },
    nextStations: ['station-9'],
  },
  {
    stationId: 'station-9',
    name: 'Kontrola 3',
    area: 'kontrola',
    mqttTopic: 'factory/station9/data',
    isAliveTopic: 'factory/station9/isalive',
    position: { x: 700, y: 520 },
    nextStations: [],
  },
];

// ---- Manualne definovane sekcie (oblasti) ----
// Na pridanie novej sekcie pridat objekt do AREAS[]
// bounds = { x, y, w, h } urcuje pozadie sekcie na mape

const AREAS: AreaConfig[] = [
  {
    areaId: 'vyroba',
    name: 'Vyroba',
    color: '#1e3a5f',
    bounds: { x: 30, y: 30, w: 800, h: 170 },
    stationIds: ['station-1', 'station-2', 'station-3'],
  },
  {
    areaId: 'montaz',
    name: 'Montaz',
    color: '#3b1f2b',
    bounds: { x: 30, y: 230, w: 800, h: 170 },
    stationIds: ['station-4', 'station-5', 'station-6'],
  },
  {
    areaId: 'kontrola',
    name: 'Kontrola',
    color: '#2b3a1f',
    bounds: { x: 30, y: 430, w: 800, h: 170 },
    stationIds: ['station-7', 'station-8', 'station-9'],
  },
];

// Build layout
const stationsRecord: Record<string, StationConfig> = {};
for (const s of STATIONS) {
  stationsRecord[s.stationId] = s;
}

export const FACTORY_LAYOUT: FactoryLayout = {
  areas: AREAS,
  stations: stationsRecord,
};

/** Get all MQTT topics (data + isAlive) that need to be subscribed to */
export function getMqttTopics(): string[] {
  const topics: string[] = [];
  for (const s of STATIONS) {
    topics.push(s.mqttTopic);
    topics.push(s.isAliveTopic);
  }
  return topics;
}

/** Map from MQTT data topic to stationId */
export function getDataTopicMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of STATIONS) {
    map.set(s.mqttTopic, s.stationId);
  }
  return map;
}

/** Map from MQTT isAlive topic to stationId */
export function getAliveTopicMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const s of STATIONS) {
    map.set(s.isAliveTopic, s.stationId);
  }
  return map;
}
