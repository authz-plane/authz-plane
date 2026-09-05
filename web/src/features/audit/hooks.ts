"use client";

import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { bffGet, bffMutate } from "@/lib/api/client";
import { auditKeys } from "./keys";
import { AuditPageSchema, ExportResponseSchema, type AuditFilter, type AuditPage } from "./schemas";

/** BFF path for a page: tenant scope uses the tenant route, platform the flat one. */
export function auditListPath(filter: AuditFilter, scopedTenant: string | undefined, cursor: string | undefined): string {
  const params = new URLSearchParams();
  if (!scopedTenant && filter.tenant) params.set("tenant", filter.tenant);
  if (filter.actor) params.set("actor", filter.actor);
  if (filter.action) params.set("action", filter.action);
  if (cursor) params.set("cursor", cursor);
  const base = scopedTenant ? `/api/tenants/${encodeURIComponent(scopedTenant)}/audit-events` : "/api/audit-events";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Cursor-paginated stream (handoff: `useInfiniteQuery`, never client-side
 * sort/filter of a page). The server page seeded page one under the same key.
 */
export function useAuditEvents(filter: AuditFilter, scopedTenant?: string) {
  return useInfiniteQuery({
    queryKey: auditKeys.list(scopedTenant ?? null, filter),
    queryFn: ({ pageParam }) => bffGet(auditListPath(filter, scopedTenant, pageParam), AuditPageSchema),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: AuditPage) => last.nextCursor ?? undefined,
  });
}

/** POST /api/tenants/{slug}/audit-exports → 202 { exportId }. bffMutate adds the Idempotency-Key. */
export function useRequestExport() {
  return useMutation({
    mutationFn: (slug: string) =>
      bffMutate(`/api/tenants/${encodeURIComponent(slug)}/audit-exports`, { method: "POST" }, ExportResponseSchema),
  });
}
