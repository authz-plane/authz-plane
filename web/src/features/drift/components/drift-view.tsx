"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Topbar } from "@/components/layout/topbar";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { Button, LinkButton } from "@/components/ui/button";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { BffError } from "@/lib/api/client";
import { utcClock } from "@/lib/format";
import { relativeAge } from "../format";
import { useAcknowledge, useDriftFinding, useDriftList, useHeal, useResyncAll } from "../hooks";
import type { DriftListFilter } from "../schemas";
import { DriftFilters } from "./drift-filters";
import { DriftStatsRow } from "./drift-stats";
import { DriftTable } from "./drift-table";
import { FindingDrawer } from "./finding-drawer";
import { SelectionFooter } from "./selection-footer";

/**
 * Client half of screen 10 (and the tenant-scoped variant). The server page
 * seeded the list under the same key; selection is client state (handoff
 * "Client state per screen: drift table (selected finding ids)"); filters and
 * the open drawer live in the URL so views are shareable.
 *
 * Platform: the drawer is the route /drift/{findingId}. Tenant scope: the
 * drawer is ?finding={id} on the tenant's drift page, so the tenant sidebar
 * stays put.
 */
export function DriftView({
  filter,
  scopedTenant,
  basePath,
  openFindingId,
}: {
  filter: DriftListFilter;
  scopedTenant?: string;
  /** "/drift" or "/tenants/{slug}/drift" */
  basePath: string;
  openFindingId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const list = useDriftList(filter, scopedTenant);
  const heal = useHeal();
  const ack = useAcknowledge();
  const resync = useResyncAll();

  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);

  const data = list.data;
  const items = useMemo(() => data?.items ?? [], [data]);

  // A stale selection (row healed elsewhere, filter changed) must not count.
  const liveSelected = useMemo(() => {
    const ids = new Set(items.map((f) => f.id));
    return new Set([...selected].filter((id) => ids.has(id)));
  }, [items, selected]);

  const inList = items.find((f) => f.id === openFindingId);
  const findingQuery = useDriftFinding(openFindingId, !inList);
  const openFinding = inList ?? findingQuery.data;

  const listQs = (() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("finding");
    return params;
  })();
  const drawerHref = (id: string) => {
    if (scopedTenant) {
      const params = new URLSearchParams(listQs);
      params.set("finding", id);
      return `${basePath}?${params.toString()}`;
    }
    const qs = listQs.toString();
    return `${basePath}/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
  };
  const closeHref = (() => {
    const qs = listQs.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  })();
  const closeDrawer = () => router.push(closeHref);

  const fail = (e: unknown) =>
    setError(
      e instanceof BffError ? { title: e.title, detail: e.detail } : { title: "Request failed", detail: String(e) },
    );

  const healIds = (ids: string[]) => {
    setError(null);
    setNotice(null);
    heal.mutate(ids, {
      onSuccess: ({ runs }) => {
        setSelected(new Set());
        setNotice(
          runs.length === 0
            ? "nothing to heal · findings were already closed"
            : `healing enqueued · ${runs.length} ${runs.length === 1 ? "reconcile" : "reconciles"}: ${runs
                .map((r) => `${r.tenant} ${r.runId.slice(0, 4)}`)
                .join(", ")}`,
        );
      },
      onError: fail,
    });
  };
  const ackIds = (ids: string[]) => {
    setError(null);
    setNotice(null);
    ack.mutate(ids, {
      onSuccess: () => {
        setSelected(new Set());
        setNotice(`${ids.length} acknowledged · suppressed until the desired value changes`);
      },
      onError: fail,
    });
  };
  const resyncAll = () => {
    setError(null);
    setNotice(null);
    resync.mutate(undefined, {
      onSuccess: (res) => setNotice(`resync enqueued · scheduled ${utcClock(res.scheduledAt)}, jittered`),
      onError: fail,
    });
  };

  const busy = heal.isPending || ack.isPending;
  const count = liveSelected.size;
  const open = data?.stats.open ?? 0;
  const meta = data
    ? `${open} open ${open === 1 ? "finding" : "findings"} · resync every ${data.resyncIntervalSeconds}s, jittered`
    : "unavailable";

  const actions = (
    <>
      <DriftFilters basePath={basePath} filter={filter} tenants={data?.tenants ?? []} scopedTenant={scopedTenant} />
      <Button variant="outline" size="sm" onClick={resyncAll} disabled={resync.isPending}>
        Resync all now
      </Button>
      <Button
        variant="drift"
        size="sm"
        disabled={count === 0 || busy}
        onClick={() => healIds([...liveSelected])}
      >
        Heal {count} selected
      </Button>
    </>
  );

  return (
    <>
      {scopedTenant ? (
        <TenantTopbar slug={scopedTenant} title="Drift" meta={meta} actions={actions} />
      ) : (
        <Topbar title="Drift" meta={meta} actions={actions} />
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6" data-fetching={list.isFetching || undefined}>
        {!data ? (
          <div className="py-[18px]">
            <ProblemNotice
              title="Drift unavailable"
              detail={
                list.error instanceof BffError
                  ? `${list.error.status} · ${list.error.message}`
                  : (list.error?.message ?? "no data")
              }
              onRetry={() => void list.refetch()}
            />
          </div>
        ) : (
          <>
            <div className="py-[18px]">
              <DriftStatsRow stats={data.stats} />
            </div>

            {(notice || error) && (
              <div className="pb-3">
                {error ? (
                  <ProblemNotice title={error.title} detail={error.detail} />
                ) : (
                  <p role="status" className="font-mono text-[11.5px] text-ready">
                    ✓ {notice}
                  </p>
                )}
              </div>
            )}

            {items.length === 0 ? (
              <EmptyState
                eyebrow={data.stats.open === 0 ? "empty · no open drift" : "empty · no matches"}
                glyph="◆"
                title={
                  data.stats.open === 0
                    ? `no open drift — last resync ${relativeAge(data.lastResyncAt, data.generatedAt)}`
                    : "no findings match these filters"
                }
                actions={
                  data.stats.open > 0 ? (
                    <LinkButton href={basePath} variant="secondary" size="sm">
                      Clear filters
                    </LinkButton>
                  ) : undefined
                }
              >
                {data.stats.open === 0
                  ? "Desired and actual state agree across every resource. The reconciler keeps resyncing on the tenant's interval."
                  : `${data.stats.open} open ${data.stats.open === 1 ? "finding is" : "findings are"} hidden by the current filter.`}
              </EmptyState>
            ) : (
              <DriftTable
                items={items}
                generatedAt={data.generatedAt}
                selected={liveSelected}
                onToggle={(id, next) =>
                  setSelected((prev) => {
                    const out = new Set(prev);
                    if (next) out.add(id);
                    else out.delete(id);
                    return out;
                  })
                }
                drawerHref={drawerHref}
                onOpen={(id) => router.push(drawerHref(id))}
                onAcknowledge={(id) => ackIds([id])}
              />
            )}

            {list.error && (
              <p role="status" className="py-3 font-mono text-[11px] text-degraded">
                ⚠ last refresh failed · showing data from {data.generatedAt} · {list.error.message}
              </p>
            )}

            <div className="mt-auto">
              <SelectionFooter
                count={count}
                busy={busy}
                onAcknowledge={() => ackIds([...liveSelected])}
                onHeal={() => healIds([...liveSelected])}
              />
            </div>
          </>
        )}
      </div>

      <FindingDrawer
        finding={openFinding}
        open={Boolean(openFindingId)}
        onClose={closeDrawer}
        onHealed={(runs) => {
          setSelected(new Set());
          setNotice(`healing enqueued · ${runs.map((r) => `${r.tenant} ${r.runId.slice(0, 4)}`).join(", ")}`);
        }}
      />
    </>
  );
}
