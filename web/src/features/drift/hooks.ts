"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffGet, bffMutate } from "@/lib/api/client";
import { driftKeys, RUNS_KEY } from "./keys";
import {
  DriftFindingSchema,
  DriftListSchema,
  HealResponseSchema,
  ResyncResponseSchema,
  type DriftList,
  type DriftListFilter,
} from "./schemas";

/** BFF path for a list: tenant scope uses the tenant route, platform the flat one. */
export function driftListPath(filter: DriftListFilter, scopedTenant?: string): string {
  const params = new URLSearchParams();
  if (filter.severity) params.set("severity", filter.severity);
  if (scopedTenant) {
    const qs = params.toString();
    return `/api/tenants/${encodeURIComponent(scopedTenant)}/drift${qs ? `?${qs}` : ""}`;
  }
  if (filter.tenant) params.set("tenant", filter.tenant);
  const qs = params.toString();
  return `/api/drift${qs ? `?${qs}` : ""}`;
}

export function useDriftList(filter: DriftListFilter, scopedTenant?: string) {
  return useQuery<DriftList>({
    queryKey: driftKeys.list(filter),
    queryFn: () => bffGet(driftListPath(filter, scopedTenant), DriftListSchema),
  });
}

export function useDriftFinding(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: driftKeys.finding(id ?? ""),
    queryFn: () => bffGet(`/api/drift/${encodeURIComponent(id ?? "")}`, DriftFindingSchema),
    enabled: enabled && !!id,
  });
}

/** Heal → invalidate drift + runs (handoff "Invalidation"). */
export function useHeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (findingIds: string[]) =>
      bffMutate("/api/drift/heal", { body: { findingIds } }, HealResponseSchema),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: driftKeys.all }),
        qc.invalidateQueries({ queryKey: RUNS_KEY }),
      ]);
    },
  });
}

export function useAcknowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (findingIds: string[]) => {
      for (const id of findingIds) {
        await bffMutate(`/api/drift/${encodeURIComponent(id)}/acknowledge`, {}, DriftFindingSchema);
      }
      return findingIds;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: driftKeys.all });
    },
  });
}

export function useResyncAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => bffMutate("/api/drift/resync", {}, ResyncResponseSchema),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: driftKeys.all });
    },
  });
}
