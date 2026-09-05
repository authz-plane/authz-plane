import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { DriftView } from "@/features/drift/components/drift-view";
import { driftKeys } from "@/features/drift/keys";
import { driftFilterFromSearch } from "@/features/drift/schemas";
import { getDriftFinding, listDrift } from "@/features/drift/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]/drift">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Drift` };
}

/**
 * Tenant-scoped screen 10. Same components; the tenant filter is fixed by the
 * path and the tenant select is hidden. The drawer is ?finding={id} here so
 * the tenant sidebar stays. The tenant layout already 404s for unknown slugs.
 */
export default async function TenantDriftPage({ params, searchParams }: PageProps<"/tenants/[slug]/drift">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { severity } = driftFilterFromSearch(sp);
  const filter = { tenant: slug, ...(severity ? { severity } : {}) };
  const findingId = typeof sp.finding === "string" && sp.finding.length > 0 ? sp.finding : undefined;

  const queryClient = new QueryClient();
  const [finding] = await Promise.all([
    findingId ? getDriftFinding(findingId) : Promise.resolve(null),
    queryClient.fetchQuery({ queryKey: driftKeys.list(filter), queryFn: () => listDrift(filter) }),
  ]);
  // A finding from another tenant is not shown under this tenant's path.
  const open = finding && finding.tenant === slug ? finding : null;
  if (open) queryClient.setQueryData(driftKeys.finding(open.id), open);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DriftView
        filter={filter}
        scopedTenant={slug}
        basePath={`/tenants/${encodeURIComponent(slug)}/drift`}
        openFindingId={open?.id}
      />
    </HydrationBoundary>
  );
}
