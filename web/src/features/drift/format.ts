import type { Tone } from "@/lib/phase";
import type { DriftFinding, Severity } from "./schemas";

/** Severity chip tones from frame 10: high red, medium amber, low neutral. */
export const SEVERITY_TONE: Record<Severity, Tone> = {
  high: "failed",
  medium: "degraded",
  low: "neutral",
};

/** The ACTUAL column takes the severity's colour; DESIRED is always green (or "absent" in meta). */
export const ACTUAL_TEXT: Record<Severity, string> = {
  high: "text-failed",
  medium: "text-degraded",
  low: "text-fg-secondary",
};

export type RowAction = "heal" | "ack" | "view-reconcile";

/**
 * Action column (frame 10 note): low severity is acknowledged rather than
 * healed; when the tenant has autoHeal on the reconciler closes the row itself
 * so the CTA becomes "view reconcile"; otherwise the human heals.
 */
export function rowActionFor(f: Pick<DriftFinding, "severity" | "autoHeal" | "reconcileRunId">): RowAction {
  if (f.severity === "low") return "ack";
  if (f.autoHeal && f.reconcileRunId) return "view-reconcile";
  return "heal";
}

/** "6m ago", "1h ago", "4h 12m ago". Both instants come from the payload so SSR and the browser agree. */
export function relativeAge(fromIso: string, toIso: string): string {
  const seconds = Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / 1000));
  if (seconds < 60) return "just now";
  return `${durationShort(seconds)} ago`;
}

/** "4h 12m", "22m", "3d 2h". Used for the "Oldest unresolved" stat. */
export function durationShort(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  return remH > 0 ? `${days}d ${remH}h` : `${days}d`;
}

/** "10:08:41Z" — seconds precision for provenance lines. */
export function utcTimeOfDay(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}Z`;
}

/** Field-diff value rendering: null is the word "absent". */
export function valueLabel(v: string | null): string {
  return v === null ? "absent" : v;
}
