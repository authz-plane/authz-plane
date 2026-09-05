"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { SplitBody } from "@/components/layout/page-header";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { Button, LinkButton } from "@/components/ui/button";
import { TableFooter } from "@/components/ui/table";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { BffError } from "@/lib/api/client";
import { groupThousands } from "@/lib/format";
import { useAuditEvents, useRequestExport } from "../hooks";
import type { AuditFilter } from "../schemas";
import { AuditFilters } from "./audit-filters";
import { AuditTable } from "./audit-table";
import { EventPanel } from "./event-panel";

/**
 * Client half of screen 17 (tenant-scoped) and the platform /audit page. The
 * server seeded page one of the infinite query; "load older" walks the
 * cursor. The selected event mirrors into ?event= so a row is linkable; the
 * first row is selected by default, as the frame shows.
 */
export function AuditView({
  filter,
  scopedTenant,
  tenants,
  initialEventId,
}: {
  filter: AuditFilter;
  scopedTenant?: string;
  /** platform page only: slugs for the tenant pill */
  tenants?: string[];
  initialEventId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = useAuditEvents(filter, scopedTenant);
  const exportReq = useRequestExport();
  const [selectedId, setSelectedId] = useState<string | undefined>(initialEventId);

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const first = pages[0];
  const selected = items.find((e) => e.id === selectedId) ?? items[0];

  const select = (id: string) => {
    setSelectedId(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("event", id);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const exportTenant = scopedTenant ?? filter.tenant;
  const scopeLabel = exportTenant ?? "all tenants";
  const meta = first ? `append-only · ${scopeLabel} · ${groupThousands(first.total)} events` : "unavailable";
  const hasFilter = Boolean(filter.actor || filter.action || (!scopedTenant && filter.tenant));
  const clearHref = pathname;

  const actions = (
    <>
      <AuditFilters filter={filter} actors={first?.actors ?? []} tenants={scopedTenant ? undefined : tenants} />
      <Button
        variant="outline"
        size="sm"
        className="h-[30px] text-[12px]"
        disabled={!exportTenant || exportReq.isPending}
        title={exportTenant ? undefined : "select a tenant to export"}
        onClick={() => exportTenant && exportReq.mutate(exportTenant)}
      >
        Export NDJSON.gz
      </Button>
    </>
  );

  const topbar = scopedTenant ? (
    <TenantTopbar slug={scopedTenant} title="Audit" meta={meta} actions={actions} />
  ) : (
    <Topbar title="Audit" meta={meta} actions={actions} />
  );

  if (!first) {
    return (
      <>
        {topbar}
        <div className="p-6">
          <ProblemNotice
            title="Audit events unavailable"
            detail={query.error instanceof BffError ? `${query.error.status} · ${query.error.message}` : (query.error?.message ?? "no data")}
            onRetry={() => void query.refetch()}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {topbar}
      {(exportReq.data || exportReq.error) && (
        <div className="border-b border-line-row px-6 py-2.5">
          {exportReq.error ? (
            <ProblemNotice
              title={exportReq.error instanceof BffError ? exportReq.error.title : "Export failed"}
              detail={exportReq.error instanceof BffError ? exportReq.error.detail : exportReq.error.message}
            />
          ) : (
            <p role="status" className="font-mono text-[11.5px] text-ready">
              ✓ export queued · {exportReq.data?.exportId} · {exportReq.data?.format} · you will be notified when it is ready
            </p>
          )}
        </div>
      )}
      <SplitBody panelWidth={400} panel={<EventPanel event={selected} />}>
        <div className="flex min-h-0 flex-col px-6" data-fetching={query.isFetching || undefined}>
          {items.length === 0 ? (
            <EmptyState eyebrow="empty · no events" glyph="○" title={hasFilter ? "No events match these filters" : "No events yet"}>
              {hasFilter ? "Filters are exact. Clear them to see the full stream." : "The first spec write for this tenant will appear here."}
              {hasFilter && (
                <div className="pt-3">
                  <LinkButton href={clearHref} variant="secondary" size="sm">
                    Clear filters
                  </LinkButton>
                </div>
              )}
            </EmptyState>
          ) : (
            <AuditTable items={items} selectedId={selected?.id} onSelect={select} showTenant={!scopedTenant} />
          )}
          <TableFooter className="px-3 text-[11.5px]">
            <span>
              index: (tenant_id, occurred_at DESC) · no UPDATE or DELETE grant on this table
              {!query.hasNextPage && items.length > 0 && (
                <span className="text-fg-footnote"> · fixture materialises {items.length} rows</span>
              )}
            </span>
            {query.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load older"}
              </Button>
            )}
          </TableFooter>
          {query.error && (
            <p role="status" className="px-3 pb-3 font-mono text-[11px] text-degraded">
              ⚠ last fetch failed · {query.error.message}
            </p>
          )}
        </div>
      </SplitBody>
    </>
  );
}
