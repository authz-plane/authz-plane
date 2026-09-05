/**
 * Retry countdown for the "Not converged" strip (handoff "Live state":
 * countdown text ticks locally from `nextAttemptAt`). Pure; the component
 * supplies `nowMs` so the server render and the first client render agree.
 */
export function retryCountdownText(nextAttemptAt: string | null, nowMs: number): string {
  if (!nextAttemptAt) return "no retry scheduled";
  const at = Date.parse(nextAttemptAt);
  if (Number.isNaN(at)) return "no retry scheduled";
  const seconds = Math.ceil((at - nowMs) / 1000);
  if (seconds <= 0) return "retrying now";
  if (seconds < 60) return `next retry in ${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `next retry in ${m}m ${String(s).padStart(2, "0")}s`;
}

/** "45s" · "11m" · "2h" · "3d" — the compact age the Recent runs list shows. */
export function compactAge(iso: string, nowMs: number): string {
  const seconds = Math.max(0, Math.floor((nowMs - Date.parse(iso)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** "24m" · "1h 12m" for the terminal-failure summary ("8 of 8 attempts exhausted over 24m"). */
export function spanLabel(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
