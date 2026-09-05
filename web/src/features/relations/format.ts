import type { Tuple, TupleInput } from "./schemas";

/** Canonical "user relation object" spelling used in the payload well and for de-duplication. */
export function tupleKey(t: TupleInput): string {
  return `${t.user} ${t.relation} ${t.object}`;
}

export function sameTuple(a: TupleInput, b: TupleInput): boolean {
  return a.user === b.user && a.relation === b.relation && a.object === b.object;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Aug 30 09:12Z" — the frame's short date plus a UTC clock so the zone is explicit. */
export function utcDayTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`;
}

/** One JSON object per line, trailing newline (NDJSON). */
export function toNdjson(items: Tuple[]): string {
  return items.map((t) => JSON.stringify(t)).join("\n") + (items.length ? "\n" : "");
}

/** "0e1f-…-9b" style preview of a UUID for the facts list. */
export function keyPreview(uuid: string): string {
  return `${uuid.slice(0, 4)}-…-${uuid.slice(-2)}`;
}
