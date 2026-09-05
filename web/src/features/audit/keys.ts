import type { AuditFilter } from "./schemas";

/** Only the defined keys, so the server seed and the client query hash identically. */
export function normalizeAuditFilter(filter: AuditFilter): AuditFilter {
  const out: AuditFilter = {};
  if (filter.tenant) out.tenant = filter.tenant;
  if (filter.actor) out.actor = filter.actor;
  if (filter.action) out.action = filter.action;
  return out;
}

/**
 * Query keys per handoff "State Management": ['audit', slug, filters]. The
 * platform page uses the literal "platform" in the slug slot; the cursor is
 * the infinite query's page param, not part of the key.
 */
export const auditKeys = {
  all: ["audit"] as const,
  list: (scope: string | null, filter: AuditFilter) => ["audit", scope ?? "platform", normalizeAuditFilter(filter)] as const,
};
