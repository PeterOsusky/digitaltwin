export function formatTime(iso: string): string {
  const d = new Date(iso);
  const hms = d.toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hms}.${ms}`;
}

export function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs}s`;
}

export function shortPartId(partId: string): string {
  // PART-2026-00142 -> #00142
  const parts = partId.split('-');
  return `#${parts[parts.length - 1]}`;
}
