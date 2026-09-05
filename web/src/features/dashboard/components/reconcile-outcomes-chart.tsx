import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { groupThousands, percent, utcClock } from "@/lib/format";
import type { DashboardOverview, OutcomeBucket } from "@/features/dashboard/schemas";

const CHART_HEIGHT_PX = 150;

/**
 * Stacked bar chart, div-based as the handoff requires: 12 columns, 150px
 * axis, 6px column gap, 2px surface gap between segments, ready at the base.
 * Status colours carry the phase; the legend words and per-column tooltips
 * carry it a second time so colour is never the only channel.
 */
const SEGMENTS = [
  { key: "ready", label: "Ready", fill: "bg-ready" },
  { key: "degraded", label: "Degraded", fill: "bg-degraded" },
  { key: "failed", label: "Failed", fill: "bg-failed" },
] as const satisfies ReadonlyArray<{
  key: keyof Omit<OutcomeBucket, "startsAt">;
  label: string;
  fill: string;
}>;

function total(b: OutcomeBucket): number {
  return b.ready + b.degraded + b.failed;
}

function describe(b: OutcomeBucket): string {
  const parts = SEGMENTS.filter((s) => b[s.key] > 0).map(
    (s) => `${b[s.key]} ${s.label.toLowerCase()}`,
  );
  return `${utcClock(b.startsAt)} · ${total(b)} runs${parts.length ? ` · ${parts.join(", ")}` : ""}`;
}

export function ReconcileOutcomesChart({
  outcomes,
}: {
  outcomes: DashboardOverview["outcomes"];
}) {
  const max = Math.max(1, ...outcomes.buckets.map(total));
  const px = (n: number) => Math.round((n / max) * CHART_HEIGHT_PX);

  return (
    <Card className="flex min-h-0 flex-col gap-4 p-[18px]">
      <div className="flex items-baseline justify-between">
        <CardTitle>Reconcile outcomes</CardTitle>
        <span className="font-mono text-[11px] text-fg-meta">
          success {percent(outcomes.successRate)} · {groupThousands(outcomes.runs)}{" "}
          runs
        </span>
      </div>

      <ol
        aria-label="Reconcile outcomes per interval"
        className="flex items-end gap-1.5"
        style={{ height: CHART_HEIGHT_PX }}
      >
        {outcomes.buckets.map((b) => (
          <li
            key={b.startsAt}
            title={describe(b)}
            aria-label={describe(b)}
            className="group flex h-full flex-1 flex-col justify-end gap-[2px]"
          >
            {/* Stack top-down so `ready` lands at the baseline. */}
            {[...SEGMENTS].reverse().map((s) =>
              b[s.key] > 0 ? (
                <div
                  key={s.key}
                  className={cn(
                    "rounded-[2px] transition-[height,filter] duration-300 group-hover:brightness-110",
                    s.fill,
                  )}
                  style={{ height: Math.max(2, px(b[s.key])) }}
                />
              ) : null,
            )}
          </li>
        ))}
      </ol>

      <ul className="flex gap-[18px] font-mono text-[11px] text-fg-meta">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-[2px]", s.fill)} />
            {s.label}
          </li>
        ))}
      </ul>
    </Card>
  );
}
