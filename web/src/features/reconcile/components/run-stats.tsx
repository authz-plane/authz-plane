import { StatCard } from "@/components/ui/stat-card";
import { groupThousands } from "@/lib/format";
import { formatDuration } from "../lib";
import type { RunStats as RunStatsShape } from "../schemas";

/** 4-up stats from frame 08: Runs · Median duration · No-change runs (ready) · Retries in backoff (degraded). */
export function RunStats({ stats }: { stats: RunStatsShape }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard label="Runs" value={groupThousands(stats.runs)} />
      <StatCard label="Median duration" value={formatDuration(stats.medianDurationMs)} />
      <StatCard label="No-change runs" value={`${Math.round(stats.noChangeRatio * 100)}%`} tone="text-ready" />
      <StatCard
        label="Retries in backoff"
        value={stats.retriesInBackoff}
        tone={stats.retriesInBackoff > 0 ? "text-degraded" : "text-fg"}
      />
    </div>
  );
}
