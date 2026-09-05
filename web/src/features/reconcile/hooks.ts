"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { bffGet, bffMutate } from "@/lib/api/client";
import { runKeys, type RunListKeyFilter } from "./keys";
import { detailPollInterval, pollIntervalForRuns } from "./lib";
import {
  RetryResponseSchema,
  RunDetailSchema,
  RunPageSchema,
  type RunDetail,
  type RunPage,
} from "./schemas";

/** BFF path for the list: platform-wide or tenant-scoped, filters in the query string. */
export function runsListPath(filter: RunListKeyFilter, tenantSlug?: string): string {
  const params = new URLSearchParams();
  if (filter.trigger) params.set("trigger", filter.trigger);
  if (filter.outcome) params.set("outcome", filter.outcome);
  if (!tenantSlug && filter.tenant) params.set("tenant", filter.tenant);
  if (filter.cursor) params.set("cursor", filter.cursor);
  const base = tenantSlug
    ? `/api/tenants/${encodeURIComponent(tenantSlug)}/reconcile-runs`
    : "/api/reconcile-runs";
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * List query. The server component seeded the cache under the same key; from
 * here on this polls at 2s while any run is Applying/Deleting, 10s otherwise,
 * and pauses on tab blur (QueryProvider default).
 */
export function useRunsQuery(filter: RunListKeyFilter, tenantSlug?: string) {
  const key = tenantSlug ? { ...filter, tenant: tenantSlug } : filter;
  return useQuery<RunPage>({
    queryKey: runKeys.list(key),
    queryFn: () => bffGet(runsListPath(filter, tenantSlug), RunPageSchema),
    refetchInterval: (query) => pollIntervalForRuns(query.state.data?.items),
  });
}

/** Detail query: 1s while the run has no finishedAt, then stops. */
export function useRunQuery(runId: string) {
  return useQuery<RunDetail>({
    queryKey: runKeys.detail(runId),
    queryFn: () => bffGet(`/api/reconcile-runs/${encodeURIComponent(runId)}`, RunDetailSchema),
    refetchInterval: (query) => detailPollInterval(query.state.data),
  });
}

/**
 * POST …/retry → 202 { runId }. Invalidates runs, the tenant and its drift
 * (handoff "Invalidation: reconcile → tenant, runs, drift"), then navigates
 * to the new run so the operator watches it apply.
 */
export function useRetryRun(run: Pick<RunDetail, "id" | "tenantSlug">) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: () =>
      bffMutate(`/api/reconcile-runs/${encodeURIComponent(run.id)}/retry`, { method: "POST" }, RetryResponseSchema),
    onSuccess: async ({ runId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: runKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["tenant", run.tenantSlug] }),
        queryClient.invalidateQueries({ queryKey: ["drift", run.tenantSlug] }),
      ]);
      router.push(`/reconcile-runs/${runId}`);
    },
  });
}
