import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { RunFilters } from "@/features/reconcile/components/run-filters";
import { RunsView } from "@/features/reconcile/components/runs-view";
import { fromSearchParamsRecord, runFilterFromParams } from "@/features/reconcile/filter";
import { normalizeRunFilter, runKeys } from "@/features/reconcile/keys";
import { RunListFilterSchema } from "@/features/reconcile/schemas";
import { listRuns } from "@/features/reconcile/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]/reconcile-runs">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Reconcile runs` };
}

/**
 * Tenant-scoped screen 08. Same feature components; the tenant filter is
 * fixed by the path and the tenant pill is hidden. The tenant layout already
 * 404s for unknown slugs.
 */
export default async function TenantReconcileRunsPage({
  params,
  searchParams,
}: PageProps<"/tenants/[slug]/reconcile-runs">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const parsed = runFilterFromParams(fromSearchParamsRecord(sp), { tenant: slug });
  const filter = parsed.ok ? parsed.filter : RunListFilterSchema.parse({ tenant: slug });
  const key = normalizeRunFilter(filter);

  const queryClient = new QueryClient();
  const page = await queryClient.fetchQuery({
    queryKey: runKeys.list(key),
    queryFn: () => listRuns(filter),
  });

  // The client re-adds the tenant from the path when it builds the key (useRunsQuery).
  const clientFilter = normalizeRunFilter({ trigger: filter.trigger, outcome: filter.outcome, cursor: filter.cursor });

  return (
    <>
      <Topbar
        title="Reconcile runs"
        meta={`${slug} · ${page.window}`}
        actions={<RunFilters filter={clientFilter} tenantSlugs={[]} showTenant={false} />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-7 py-[18px]">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RunsView filter={clientFilter} tenantSlug={slug} />
        </HydrationBoundary>
      </div>
    </>
  );
}
