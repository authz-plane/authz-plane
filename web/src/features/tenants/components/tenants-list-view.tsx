"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState } from "@/components/states/system-states";
import { LinkButton } from "@/components/ui/button";
import { bffGet } from "@/lib/api/client";
import { pollIntervalFor } from "@/features/dashboard/polling";
import { hasActiveFilters, tenantListApiPath, tenantListHref } from "../filters";
import { tenantKeys } from "../keys";
import { TenantPageSchema, type TenantListFilter, type TenantPage } from "../schemas";
import { TenantFilterBar } from "./tenant-filter-bar";
import { TenantPager, TenantTable } from "./tenant-table";

const DOCS_HREF = "https://authz-plane.is-a.dev/docs";

/**
 * Client half of screen 03. The page prefetched the first page into the cache
 * under ['tenants', filter]; from here on this polls /api/tenants at 2s while
 * any tenant is in flight, 10s once settled, pausing on tab blur. Filters and
 * cursor are URL state; nothing is sorted or filtered here.
 */
export function TenantsListView({ filter, now }: { filter: TenantListFilter; now: string }) {
  const { data, error, isFetching } = useQuery<TenantPage>({
    queryKey: tenantKeys.list(filter),
    queryFn: () => bffGet(tenantListApiPath(filter), TenantPageSchema),
    refetchInterval: (query) => pollIntervalFor(query.state.data?.counts.byPhase),
  });

  if (!data) {
    return (
      <div className="m-7 rounded-inner border border-failed-border-strong bg-failed-tint-deep p-4 text-[12.5px] text-fg-secondary">
        <div className="font-semibold text-failed">Tenant list unavailable</div>
        <div className="mt-1 font-mono text-[11.5px]">{error instanceof Error ? error.message : "no data"}</div>
      </div>
    );
  }

  const filtered = hasActiveFilters(filter);
  const fleetEmpty = data.counts.all === 0 && !filtered;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-fetching={isFetching || undefined}>
      <TenantFilterBar filter={filter} counts={data.counts} />
      <div className="min-h-0 flex-1 overflow-auto">
        {data.items.length === 0 ? (
          fleetEmpty ? (
            <EmptyState
              eyebrow="Empty · no tenants yet"
              title="No tenants yet"
              className="mx-auto items-center py-16 text-center"
              actions={
                <>
                  <LinkButton href="/tenants/new" variant="primary" size="md">
                    New tenant
                  </LinkButton>
                  <LinkButton href={DOCS_HREF} variant="outline" size="md" external>
                    Read the docs
                  </LinkButton>
                </>
              }
            >
              Create one to write your first desired-state spec, or seed the local stack with{" "}
              <code className="font-mono text-fg-code">make seed</code>.
            </EmptyState>
          ) : (
            <EmptyState
              glyph="⌕"
              title="No tenants match"
              className="mx-auto items-center py-16 text-center"
              actions={
                <LinkButton href={tenantListHref(filter, { phase: undefined, hasDrift: undefined, q: undefined })} variant="outline" size="md">
                  Clear filters
                </LinkButton>
              }
            >
              Nothing in the fleet matches {describeFilter(filter)}. Widen the search or clear the filters.
            </EmptyState>
          )
        ) : (
          <TenantTable items={data.items} now={now} />
        )}
      </div>
      <TenantPager filter={filter} page={data} />
      {error && (
        <p role="status" className="px-7 pb-3 font-mono text-[11px] text-degraded">
          ⚠ last refresh failed · showing the previous page ·{" "}
          {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}
    </div>
  );
}

function describeFilter(filter: TenantListFilter): string {
  const parts: string[] = [];
  if (filter.phase) parts.push(`phase ${filter.phase}`);
  if (filter.hasDrift) parts.push("open drift");
  if (filter.q) parts.push(`"${filter.q}"`);
  return parts.length ? parts.join(" · ") : "these filters";
}
