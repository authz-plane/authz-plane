import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { RunFilters } from "@/features/reconcile/components/run-filters";
import { RunsView } from "@/features/reconcile/components/runs-view";
import { fromSearchParamsRecord, runFilterFromParams } from "@/features/reconcile/filter";
import { normalizeRunFilter, runKeys } from "@/features/reconcile/keys";
import { RunListFilterSchema } from "@/features/reconcile/schemas";
import { listRuns } from "@/features/reconcile/server";
import { TENANTS } from "@/features/tenants/fixtures";

export const metadata: Metadata = { title: "Reconcile runs" };

/**
 * Screen 08. Filters live in the URL; the server parses them, fetches the
 * first page into the query cache, and the client view polls from there.
 */
export default async function ReconcileRunsPage({ searchParams }: PageProps<"/reconcile-runs">) {
  const params = await searchParams;
  const parsed = runFilterFromParams(fromSearchParamsRecord(params));
  // A bad filter in a shared link falls back to "any" rather than a 400 page.
  const filter = parsed.ok ? parsed.filter : RunListFilterSchema.parse({});
  const key = normalizeRunFilter(filter);

  const queryClient = new QueryClient();
  const page = await queryClient.fetchQuery({
    queryKey: runKeys.list(key),
    queryFn: () => listRuns(filter),
  });

  return (
    <>
      <Topbar
        title="Reconcile runs"
        meta={`${filter.tenant ?? "all tenants"} · ${page.window}`}
        actions={<RunFilters filter={key} tenantSlugs={TENANTS.map((t) => t.slug)} />}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-7 py-[18px]">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <RunsView filter={key} />
        </HydrationBoundary>
      </div>
    </>
  );
}
