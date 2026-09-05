"use client";

import { useQuery } from "@tanstack/react-query";
import { bffGet } from "@/lib/api/client";
import { dashboardKeys } from "@/features/dashboard/keys";
import { pollIntervalFor } from "@/features/dashboard/polling";
import {
  DashboardOverviewSchema,
  type DashboardOverview,
  type Window,
} from "@/features/dashboard/schemas";
import { KpiGrid } from "./kpi-grid";
import { NeedsAttention } from "./needs-attention";
import { ReconcileOutcomesChart } from "./reconcile-outcomes-chart";

/**
 * Client half of the overview. The server component prefetched the first
 * payload into the query cache; from here on this polls /api/dashboard at 2s
 * while anything is in flight, 10s once settled, and pauses on tab blur.
 */
export function DashboardView({ window }: { window: Window }) {
  const { data, error, isFetching } = useQuery<DashboardOverview>({
    queryKey: dashboardKeys.overview(window),
    queryFn: () =>
      bffGet(
        `/api/dashboard?window=${encodeURIComponent(window)}`,
        DashboardOverviewSchema,
      ),
    refetchInterval: (query) =>
      pollIntervalFor(query.state.data?.tenants.byPhase),
  });

  if (!data) {
    // Only reachable if hydration failed; the server always seeds the cache.
    return (
      <div className="rounded-inner border border-failed-border-strong bg-failed-tint-deep p-4 text-[12.5px] text-fg-secondary">
        <div className="font-semibold text-failed">Overview unavailable</div>
        <div className="mt-1 font-mono text-[11.5px]">
          {error instanceof Error ? error.message : "no data"}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-5"
      data-fetching={isFetching || undefined}
    >
      <KpiGrid data={data} />
      <div className="grid min-h-0 flex-1 grid-cols-[1.55fr_1fr] gap-3.5">
        <ReconcileOutcomesChart outcomes={data.outcomes} />
        <NeedsAttention items={data.needsAttention} />
      </div>
      {error && (
        <p
          role="status"
          className="font-mono text-[11px] text-degraded"
        >
          ⚠ last refresh failed · showing data from {data.generatedAt} ·{" "}
          {error instanceof Error ? error.message : "unknown error"}
        </p>
      )}
    </div>
  );
}
