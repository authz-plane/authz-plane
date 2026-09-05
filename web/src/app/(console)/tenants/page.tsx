import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Topbar } from "@/components/layout/topbar";
import { LinkButton } from "@/components/ui/button";
import { TenantSearch } from "@/features/tenants/components/tenant-search";
import { TenantsListView } from "@/features/tenants/components/tenants-list-view";
import { searchParamsFrom, tenantListFilterFromParams } from "@/features/tenants/filters";
import { FIXTURE_NOW } from "@/features/tenants/fixtures";
import { tenantKeys } from "@/features/tenants/keys";
import { listTenants } from "@/features/tenants/server";

export const metadata: Metadata = { title: "Tenants" };

/**
 * Screen 03. Filters and cursor live in the URL; the server parses them,
 * fetches the first page into the query cache under ['tenants', filter], and
 * the client view polls /api/tenants from there (2s while anything is in
 * flight, 10s once settled). Nothing is sorted or filtered client-side.
 */
export default async function TenantsPage({ searchParams }: PageProps<"/tenants">) {
  const filter = tenantListFilterFromParams(searchParamsFrom(await searchParams));

  const queryClient = new QueryClient();
  const page = await queryClient.fetchQuery({
    queryKey: tenantKeys.list(filter),
    queryFn: () => listTenants(filter),
  });

  // Fixture rows are relative to FIXTURE_NOW; switch to new Date().toISOString() with the API.
  const now = FIXTURE_NOW;

  return (
    <>
      <Topbar
        title="Tenants"
        meta={`${page.counts.all} tenants · ${page.counts.withDrift} with open drift`}
        actions={
          <>
            <TenantSearch filter={filter} />
            <LinkButton href="/tenants/new" variant="primary" size="sm">
              New tenant
            </LinkButton>
          </>
        }
      />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <TenantsListView filter={filter} now={now} />
      </HydrationBoundary>
    </>
  );
}
