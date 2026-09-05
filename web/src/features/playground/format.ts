import type { Consistency, ExplainRequestInput } from "./schemas";

/** "2026-09-04T10:15:00Z" -> "10:15:00Z". Fixed zone so SSR and the browser agree. */
export function checkedAtLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}Z`;
}

/** Header meta line under the ALLOWED / DENIED chip. */
export function resultMeta(r: { durationMs: number; cached: boolean; modelVersion: number; checkedAt: string }): string {
  return `${r.durationMs}ms · cache ${r.cached ? "hit" : "miss"} · model v${r.modelVersion} · checkedAt ${checkedAtLabel(r.checkedAt)}`;
}

/** BFF path for the explain call; `?consistency=strong` only when the toggle is on (handoff "Mutations"). */
export function explainPath(slug: string, consistency: Consistency): string {
  const base = `/api/tenants/${encodeURIComponent(slug)}/explain`;
  return consistency === "strong" ? `${base}?consistency=strong` : base;
}

export function batchCheckPath(slug: string, consistency: Consistency): string {
  const base = `/api/tenants/${encodeURIComponent(slug)}/batch-check`;
  return consistency === "strong" ? `${base}?consistency=strong` : base;
}

/**
 * "Copy as curl": the public API call this BFF request stands in for. The
 * bearer token is a shell variable the operator fills in; the console never
 * has one to paste.
 */
export function curlFor(slug: string, request: ExplainRequestInput, consistency: Consistency): string {
  const query = consistency === "strong" ? "?consistency=strong" : "";
  const body = JSON.stringify({
    user: request.user,
    relation: request.relation,
    object: request.object,
    includeProvenance: request.includeProvenance ?? true,
  });
  const cont = " \\";
  return [
    `curl -X POST "$AUTHZ_PLANE_API/v1/tenants/${slug}/explain${query}"${cont}`,
    `  -H "Authorization: Bearer $AUTHZ_PLANE_TOKEN"${cont}`,
    `  -H "Content-Type: application/json"${cont}`,
    `  -H "Idempotency-Key: $(uuidgen)"${cont}`,
    `  -d '${body}'`,
  ].join("\n");
}
