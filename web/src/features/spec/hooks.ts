"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { bffGet, bffMutate } from "@/lib/api/client";
import { fnv1a } from "./hash";
import { specKeys } from "./keys";
import {
  PlanSchema,
  ReconcileAcceptedSchema,
  SaveSpecResponseSchema,
  SpecDocumentSchema,
  SpecVersionsSchema,
  ValidationResponseSchema,
  type Plan,
  type ReconcileAccepted,
  type SpecDocument,
  type SpecVersions,
} from "./schemas";

const api = (slug: string) => `/api/tenants/${encodeURIComponent(slug)}`;

export function useSpecQuery(slug: string) {
  return useQuery<SpecDocument>({
    queryKey: specKeys.current(slug),
    queryFn: () => bffGet(`${api(slug)}/spec`, SpecDocumentSchema),
  });
}

export function useVersionsQuery(slug: string) {
  return useQuery<SpecVersions>({
    queryKey: specKeys.versions(slug),
    queryFn: () => bffGet(`${api(slug)}/spec/versions`, SpecVersionsSchema),
  });
}

/** POST …/spec/validate. Pure on the server; the caller debounces. */
export function useValidateSpec(slug: string) {
  return useMutation({
    mutationFn: (body: string) => bffMutate(`${api(slug)}/spec/validate`, { body: { body } }, ValidationResponseSchema),
  });
}

/**
 * Handoff "Invalidation": a spec write touches the tenant, the spec versions
 * and the runs list. Shared by save and restore.
 */
export function useInvalidateSpecWrite(slug: string) {
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant", slug] }),
      queryClient.invalidateQueries({ queryKey: specKeys.all(slug) }),
      queryClient.invalidateQueries({ queryKey: ["runs"] }),
    ]);
  };
}

/** PUT …/spec with `If-Match: <generation>` → 202 { generation, runId }; 412 surfaces as BffError(412). */
export function useSaveSpec(slug: string) {
  const invalidate = useInvalidateSpecWrite(slug);
  return useMutation({
    mutationFn: ({ body, ifMatch }: { body: string; ifMatch: number }) =>
      bffMutate(`${api(slug)}/spec`, { method: "PUT", body: { body }, headers: { "if-match": String(ifMatch) } }, SaveSpecResponseSchema),
    onSuccess: invalidate,
  });
}

/** POST …/spec/versions/{gen}/restore → 202 { generation, runId }. Never mutates history. */
export function useRestoreVersion(slug: string) {
  const invalidate = useInvalidateSpecWrite(slug);
  return useMutation({
    mutationFn: (generation: number) =>
      bffMutate(`${api(slug)}/spec/versions/${generation}/restore`, { method: "POST" }, SaveSpecResponseSchema),
    onSuccess: invalidate,
  });
}

/**
 * POST …/reconcile?dryRun=true (screen 07). Keyed on the draft's content hash
 * so re-opening the modal for the same draft is a cache hit; a POST because
 * the planner takes the body, but it has no side effects.
 */
export function usePlanQuery(slug: string, draftBody: string | undefined, enabled: boolean) {
  return useQuery<Plan>({
    queryKey: specKeys.plan(slug, draftBody === undefined ? "current" : fnv1a(draftBody)),
    queryFn: () =>
      bffMutate(`${api(slug)}/reconcile?dryRun=true`, { body: draftBody === undefined ? {} : { body: draftBody } }, PlanSchema),
    enabled,
    staleTime: 30_000,
  });
}

/**
 * POST …/reconcile → 202 { runId }. Reconcile → invalidate tenant, runs,
 * drift (handoff "Invalidation"). The caller decides whether to navigate.
 */
export function useReconcileNow(slug: string, onAccepted?: (accepted: ReconcileAccepted) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => bffMutate(`${api(slug)}/reconcile`, { method: "POST" }, ReconcileAcceptedSchema),
    onSuccess: async (accepted) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tenant", slug] }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["drift", slug] }),
      ]);
      onAccepted?.(accepted);
    },
  });
}
