import "server-only";

import { findTenant } from "@/features/tenants/fixtures";
import { AUDIT_EVENTS, AUDIT_TOTAL_DEFAULT, AUDIT_TOTAL_PLATFORM, AUDIT_TOTALS } from "./fixtures";
import { AuditPageSchema, ExportResponseSchema, type Actor, type AuditFilter, type AuditPage, type ExportResponse } from "./schemas";

/**
 * Server-side audit access. Pages and the route handlers both call these so
 * the hydrated first page and the client's "load older" pages agree.
 *
 * Fixtures until AuthzPlane.Api exposes GET /v1/tenants/{id}/audit-events.
 * Reads never mutate anything; the export request keeps an in-memory map of
 * Idempotency-Key → exportId so a replayed click returns the same export.
 * That map resets when the server process restarts.
 */

export const AUDIT_PAGE_SIZE = 8;

const CURSOR = /^c(\d+)$/;

/**
 * List newest-first with an opaque offset cursor. Returns null when the
 * scoped tenant does not exist so the route can answer 404. Filters are
 * applied server-side; the client never sorts or filters a page.
 */
export async function listAuditEvents(
  filter: AuditFilter,
  cursor: string | undefined,
  now = new Date(),
  limit = AUDIT_PAGE_SIZE,
): Promise<AuditPage | null> {
  if (filter.tenant && !findTenant(filter.tenant)) return null;

  // The fixture array is grouped by tenant; the index order is occurred_at DESC across the scope.
  const scope = (filter.tenant ? AUDIT_EVENTS.filter((e) => e.tenant === filter.tenant) : [...AUDIT_EVENTS]).sort(
    (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id),
  );
  const filtered = scope.filter(
    (e) => (!filter.actor || e.actor.id === filter.actor) && (!filter.action || e.action === filter.action),
  );
  const offset = cursor ? Number(CURSOR.exec(cursor)?.[1] ?? 0) : 0;
  const items = filtered.slice(offset, offset + limit);
  const end = offset + items.length;
  const hasFilter = Boolean(filter.actor || filter.action);

  const actors = new Map<string, Actor>();
  for (const e of scope) actors.set(e.actor.id, e.actor);

  return AuditPageSchema.parse({
    generatedAt: now.toISOString(),
    items,
    nextCursor: end < filtered.length ? `c${end}` : null,
    total: hasFilter
      ? filtered.length
      : filter.tenant
        ? (AUDIT_TOTALS[filter.tenant] ?? AUDIT_TOTAL_DEFAULT)
        : AUDIT_TOTAL_PLATFORM,
    actors: [...actors.values()].sort((a, b) => a.label.localeCompare(b.label)),
  });
}

const exports = new Map<string, ExportResponse>();

/**
 * POST …/audit-exports → 202 { exportId }. The real API streams the tenant's
 * events to object storage as NDJSON.gz and notifies when ready; here we only
 * mint the id. Replaying the same Idempotency-Key returns the first export.
 */
export async function requestAuditExport(slug: string, idempotencyKey: string): Promise<ExportResponse | null> {
  if (!findTenant(slug)) return null;
  const key = `${slug}:${idempotencyKey}`;
  const existing = exports.get(key);
  if (existing) return existing;
  const created = ExportResponseSchema.parse({
    exportId: `exp_${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`,
    status: "queued",
    format: "ndjson.gz",
  });
  exports.set(key, created);
  return created;
}

/** Tests only: forget queued exports. */
export function resetAuditExportsForTests(): void {
  exports.clear();
}
