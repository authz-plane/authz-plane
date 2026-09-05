import { StatCard } from "@/components/ui/stat-card";
import { durationShort } from "../format";
import type { DriftStats } from "../schemas";

/**
 * Frame 10's 4-up: Open (purple number on a purple-tinted card), Tenants
 * affected, Oldest unresolved (amber), Healed today (green).
 */
export function DriftStatsRow({ stats }: { stats: DriftStats }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <StatCard
        label="Open findings"
        value={stats.open}
        tone={stats.open > 0 ? "text-drift" : "text-fg"}
        tint={stats.open > 0 ? "border-drift-border bg-drift-tint" : undefined}
      />
      <StatCard label="Tenants affected" value={stats.tenantsAffected} />
      <StatCard
        label="Oldest unresolved"
        value={stats.oldestUnresolvedSeconds === null ? "—" : durationShort(stats.oldestUnresolvedSeconds)}
        tone={stats.oldestUnresolvedSeconds === null ? "text-fg-meta" : "text-degraded"}
      />
      <StatCard label="Healed today" value={stats.healedToday} tone="text-ready" />
    </div>
  );
}
