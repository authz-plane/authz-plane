import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { AuditView } from "@/features/audit/components/audit-view";
import { auditKeys } from "@/features/audit/keys";
import { auditFilterFromSearch } from "@/features/audit/schemas";
import { listAuditEvents } from "@/features/audit/server";
import { TENANTS } from "@/features/tenants/fixtures";

export const metadata: Metadata = { title: "Audit" };

/**
 * Platform-wide audit stream: screen 17 with a TENANT column and a tenant
 * pill. Same components as the tenant page; a bad tenant filter in a shared
 * link falls back to "any" rather than a 404.
 */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const sp = await searchParams;
  const parsed = auditFilterFromSearch(sp);
  const eventId = typeof sp.event === "string" && sp.event.length > 0 ? sp.event : undefined;

  let first = await listAuditEvents(parsed, undefined);
  let filter = parsed;
  if (!first) {
    filter = { ...parsed };
    delete filter.tenant;
    first = (await listAuditEvents(filter, undefined))!;
  }

  const queryClient = new QueryClient();
  queryClient.setQueryData(auditKeys.list(null, filter), { pages: [first], pageParams: [undefined] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuditView filter={filter} tenants={TENANTS.map((t) => t.slug)} initialEventId={eventId} />
    </HydrationBoundary>
  );
}
