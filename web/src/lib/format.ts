/** Formatting helpers. Everything here is deterministic across server and client so hydration never disagrees. */

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** 0.9921 -> "99.2%" */
export function percent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Narrow no-break space (U+202F) thousands separator, as the handoff writes "1 284". */
export function groupThousands(n: number): string {
  return n.toLocaleString("en-US").replaceAll(",", " ");
}

/** UTC clock label, e.g. "10:15Z". Fixed zone so SSR and the browser agree. */
export function utcClock(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}Z`;
}
