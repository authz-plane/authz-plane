"use client";

import { ProblemNotice } from "@/components/states/system-states";
import { BffError } from "@/lib/api/client";
import { useRunsQuery } from "../hooks";
import type { RunListKeyFilter } from "../keys";
import { RunStats } from "./run-stats";
import { RunsTable } from "./runs-table";

/**
 * Client half of screen 08 (and the tenant-scoped variant when `tenantSlug`
 * is set). The server component seeded the query cache; this polls from
 * there: 2s while any run is in flight, 10s otherwise.
 */
export function RunsView({ filter, tenantSlug }: { filter: RunListKeyFilter; tenantSlug?: string }) {
  const { data, error, isFetching, refetch } = useRunsQuery(filter, tenantSlug);

  if (!data) {
    // Only reachable if hydration failed; the server always seeds the cache.
    return (
      <ProblemNotice
        title="Reconcile runs unavailable"
        detail={error instanceof BffError ? `${error.status} · ${error.message}` : error?.message ?? "no data"}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4" data-fetching={isFetching || undefined}>
      <RunStats stats={data.stats} />
      <RunsTable runs={data.items} />
      {data.nextCursor && (
        <p className="font-mono text-[11px] text-fg-meta">
          showing {data.items.length} of {data.total} · cursor paginated
        </p>
      )}
      {error && (
        <p role="status" className="font-mono text-[11px] text-degraded">
          ⚠ last refresh failed · showing data from {data.generatedAt} · {error.message}
        </p>
      )}
    </div>
  );
}
