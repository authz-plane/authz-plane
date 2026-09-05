"use client";

import { useQuery } from "@tanstack/react-query";
import { bffGet } from "@/lib/api/client";
import { pollIntervalFor } from "@/features/dashboard/polling";
import { tenantKeys } from "@/features/tenants/keys";
import { TenantDetailSchema, type TenantDetail } from "@/features/tenants/schemas";

/**
 * Screen 04 polls GET /api/tenants/{slug}: 2s while the tenant is
 * Planning/Applying/Deleting, 10s otherwise, paused on tab blur by the
 * QueryProvider default. The server seeded the cache under the same key.
 */
export function useTenantDetailQuery(slug: string) {
  return useQuery<TenantDetail>({
    queryKey: tenantKeys.detail(slug),
    queryFn: () => bffGet(`/api/tenants/${encodeURIComponent(slug)}`, TenantDetailSchema),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return pollIntervalFor(phase ? { [phase]: 1 } : undefined);
    },
  });
}
