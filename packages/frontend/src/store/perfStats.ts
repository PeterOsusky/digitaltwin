/**
 * Performance stats tracking (outside Zustand to avoid triggering re-renders).
 * Updated from the FE metric flush loop.
 * Read from UI via usePerfStats() hook with polling.
 */

export interface PerfSnapshot {
  /** Metrics in last flush */
  lastFlushSize: number;
  /** Unique station IDs in last flush */
  lastFlushStations: number;
  /** Store update time in ms */
  lastUpdateMs: number;
  /** Total metric messages received since init */
  totalMetricsReceived: number;
  /** Messages per second (rolling 10s window) */
  metricsPerSecond: number;
  /** Unique topic count */
  uniqueTopics: number;
  /** Timestamp of last flush */
  lastFlushAt: number;
}

const WINDOW_MS = 10_000;
const flushLog: Array<{ size: number; at: number }> = [];

export const perfStats: PerfSnapshot = {
  lastFlushSize: 0,
  lastFlushStations: 0,
  lastUpdateMs: 0,
  totalMetricsReceived: 0,
  metricsPerSecond: 0,
  uniqueTopics: 0,
  lastFlushAt: 0,
};

export function recordFlush(flushSize: number, uniqueStations: number, updateMs: number, totalReceived: number, topicCount: number) {
  const now = Date.now();

  perfStats.lastFlushSize = flushSize;
  perfStats.lastFlushStations = uniqueStations;
  perfStats.lastUpdateMs = updateMs;
  perfStats.totalMetricsReceived = totalReceived;
  perfStats.uniqueTopics = topicCount;
  perfStats.lastFlushAt = now;

  flushLog.push({ size: flushSize, at: now });

  const cutoff = now - WINDOW_MS;
  while (flushLog.length > 0 && flushLog[0].at < cutoff) {
    flushLog.shift();
  }

  const totalInWindow = flushLog.reduce((sum, b) => sum + b.size, 0);
  perfStats.metricsPerSecond = Math.round(totalInWindow / (WINDOW_MS / 1000));
}
