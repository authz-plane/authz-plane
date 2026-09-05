import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunListFilterSchema } from "@/features/reconcile/schemas";
import { listRuns } from "@/features/reconcile/server";
import { TenantDetailView } from "@/features/tenants/components/detail/tenant-detail-view";
import { FIXTURE_NOW } from "@/features/tenants/fixtures";
import { tenantKeys } from "@/features/tenants/keys";
import { getTenant } from "@/features/tenants/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Overview` };
}

/**
 * Screen 04. The server seeds ['tenant', slug] and the five most recent runs;
 * the client view polls the tenant and hosts the plan modal (?plan=1).
 */
export default async function TenantDetailPage({ params }: PageProps<"/tenants/[slug]">) {
  const { slug } = await params;
  const queryClient = new QueryClient();
  const [tenant, runs] = await Promise.all([
    queryClient.fetchQuery({ queryKey: tenantKeys.detail(slug), queryFn: () => getTenant(slug) }),
    listRuns(RunListFilterSchema.parse({ tenant: slug, limit: 5 })),
  ]);
  if (!tenant) notFound();

  // Fixture rows are relative to FIXTURE_NOW; switch to new Date().toISOString() with the API.
  const now = FIXTURE_NOW;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TenantDetailView slug={slug} runs={runs.items} now={now} />
    </HydrationBoundary>
  );
}
