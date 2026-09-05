import type { Tone } from "@/lib/phase";
import type { AuditAction, AuditEvent } from "./schemas";

/** ACTION colours from frame 17: blue for intent/reads, amber degraded, purple drift, green writes, red secrets. */
export const ACTION_TONE: Record<AuditAction, Tone> = {
  SpecUpdated: "link",
  ReconcileSucceeded: "ready",
  ReconcileDegraded: "degraded",
  ReconcileFailed: "failed",
  DriftDetected: "drift",
  DriftHealed: "drift",
  DriftAcknowledged: "neutral",
  RelationsWritten: "ready",
  TupleWritten: "ready",
  IdpSecretRotated: "failed",
  CheckExplained: "link",
  TenantCreated: "link",
};

/** "4bf9…a1" — first four and last two hex chars, as every REQUEST cell and context row reads. */
export function shortId(id: string, head = 4, tail = 2): string {
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

/** "10:14:22Z" for the table, "10:14:22.481Z" for the panel. Fixed zone so SSR and the browser agree. */
export function utcTime(iso: string, withMillis = false): string {
  const d = new Date(iso);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const base = `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
  return withMillis ? `${base}.${p(d.getUTCMilliseconds(), 3)}Z` : `${base}Z`;
}

/** The JSON the "Copy JSON" button puts on the clipboard: the event as stored, stable key order. */
export function eventJson(event: AuditEvent): string {
  return JSON.stringify(event, null, 2);
}
