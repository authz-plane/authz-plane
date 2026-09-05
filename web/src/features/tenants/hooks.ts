"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { bffGet, bffMutate } from "@/lib/api/client";
import type { SlugStatus } from "./components/new-tenant/form-state";
import { tenantKeys } from "./keys";
import { SlugCheckSchema, TenantSummarySchema, type CreateTenantInput, type TenantSummary } from "./schemas";
import { validateSlug } from "./slug";

export const SLUG_CHECK_DEBOUNCE_MS = 400;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Async slug availability for screen 19: validates locally first, then asks
 * GET /api/tenants/slug-check 400ms after typing stops (handoff "Forms").
 */
export function useSlugCheck(slug: string): SlugStatus {
  const debounced = useDebouncedValue(slug, SLUG_CHECK_DEBOUNCE_MS);
  const localProblem = validateSlug(debounced);
  const query = useQuery({
    queryKey: tenantKeys.slugCheck(debounced),
    queryFn: () => bffGet(`/api/tenants/slug-check?slug=${encodeURIComponent(debounced)}`, SlugCheckSchema),
    enabled: debounced.length > 0 && localProblem === null,
    staleTime: 30_000,
  });

  if (slug.length === 0) return { kind: "empty" };
  const immediate = validateSlug(slug);
  if (immediate) return { kind: "invalid", reason: immediate };
  if (slug !== debounced || query.isPending) return { kind: "checking" };
  if (query.error) return { kind: "error", reason: query.error.message };
  if (query.data.available) return { kind: "available" };
  return { kind: "taken", reason: query.data.reason ?? "taken" };
}

/** POST /api/tenants (Idempotency-Key added by bffMutate); a success invalidates every tenant list. */
export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation<TenantSummary, Error, CreateTenantInput>({
    mutationFn: (input) => bffMutate("/api/tenants", { method: "POST", body: input }, TenantSummarySchema),
    onSuccess: (created) => {
      queryClient.setQueryData(tenantKeys.detail(created.slug), created);
      return queryClient.invalidateQueries({ queryKey: tenantKeys.all });
    },
  });
}
