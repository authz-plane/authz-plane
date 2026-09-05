import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuditView } from "@/features/audit/components/audit-view";
import { auditKeys } from "@/features/audit/keys";
import { auditFilterFromSearch } from "@/features/audit/schemas";
import { listAuditEvents } from "@/features/audit/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]/audit-events">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Audit` };
}

/**
 * Screen 17. Actor/action filters and the selected event come from the URL;
 * the server seeds page one of the infinite query and the client walks the
 * cursor for older events.
 */
export default async function TenantAuditEventsPage({ params, searchParams }: PageProps<"/tenants/[slug]/audit-events">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { actor, action } = auditFilterFromSearch(sp);
  const filter = { ...(actor ? { actor } : {}), ...(action ? { action } : {}) };
  const eventId = typeof sp.event === "string" && sp.event.length > 0 ? sp.event : undefined;

  const first = await listAuditEvents({ ...filter, tenant: slug }, undefined);
  if (!first) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(auditKeys.list(slug, filter), { pages: [first], pageParams: [undefined] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuditView filter={filter} scopedTenant={slug} initialEventId={eventId} />
    </HydrationBoundary>
  );
}
