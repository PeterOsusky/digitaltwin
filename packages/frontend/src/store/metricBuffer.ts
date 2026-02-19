/**
 * FE-side metric buffer — collects metric_update WS messages outside Zustand.
 * Flushed periodically (500ms) into Zustand store via single set().
 * Also stores ALL topic last-values for the Topic Data Viewer.
 */

export interface MetricEntry {
  stationId: string;
  metric: string;
  value: number;
  unit: string;
}

export interface TopicRecord {
  stationId: string;
  metric: string;
  value: number;
  unit: string;
  receivedAt: number; // Date.now()
}

// --- Pending buffer (flushed into Zustand) ---
const pendingBuffer: MetricEntry[] = [];

// --- All topics last-value map (never cleared — for Topic Data Viewer) ---
const topicMap = new Map<string, TopicRecord>();

/** Total metrics received since page load */
let totalReceived = 0;

/** Push a metric_update into the pending buffer + topic map */
export function pushMetric(entry: MetricEntry) {
  pendingBuffer.push(entry);
  totalReceived++;

  const key = `${entry.stationId}/${entry.metric}`;
  topicMap.set(key, {
    stationId: entry.stationId,
    metric: entry.metric,
    value: entry.value,
    unit: entry.unit,
    receivedAt: Date.now(),
  });
}

/** Flush pending buffer — returns entries and clears the buffer */
export function flushMetrics(): MetricEntry[] {
  if (pendingBuffer.length === 0) return [];
  return pendingBuffer.splice(0);
}

/** Get all topic last-values (for Topic Data Viewer) */
export function getTopicSnapshot(): Map<string, TopicRecord> {
  return topicMap;
}

/** Get topic count */
export function getTopicCount(): number {
  return topicMap.size;
}

/** Get total metrics received */
export function getTotalReceived(): number {
  return totalReceived;
}
