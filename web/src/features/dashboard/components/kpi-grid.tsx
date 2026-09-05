import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { DashboardOverview } from "@/features/dashboard/schemas";

/** One KPI tile: 12px label, 30px mono number (line-height 1), one line of mono meta or a 4px bar. */
function Kpi({
  label,
  value,
  unit,
  tone,
  footer,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  tone?: string;
  footer: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2.5 p-4">
      <span className="text-[12px] text-fg-tertiary">{label}</span>
      <span
        className={cn(
          "font-mono text-[30px] leading-none tabular-nums transition-colors duration-150",
          tone ?? "text-fg",
        )}
      >
        {value}
        {unit !== undefined && (
          <span className="text-[14px] text-fg-meta">{unit}</span>
        )}
      </span>
      {footer}
    </Card>
  );
}

function Meta({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("font-mono text-[11px] leading-[1.5]", className)}>
      {children}
    </span>
  );
}

export function KpiGrid({ data }: { data: DashboardOverview }) {
  const { tenants, convergenceLag, drift, outbox } = data;
  const convergedPct =
    tenants.total === 0 ? 0 : Math.round((tenants.converged / tenants.total) * 100);
  const withinSlo = convergenceLag.p95Seconds < convergenceLag.sloSeconds;

  return (
    <div className="grid grid-cols-4 gap-3.5">
      <Kpi
        label="Converged"
        value={tenants.converged}
        unit={`/${tenants.total}`}
        tone="text-ready"
        footer={
          <div
            role="meter"
            aria-label="Tenants converged"
            aria-valuemin={0}
            aria-valuemax={tenants.total}
            aria-valuenow={tenants.converged}
            className="h-1 overflow-hidden rounded-[4px] bg-line"
          >
            <div
              className="h-full bg-ready transition-[width] duration-300"
              style={{ width: `${convergedPct}%` }}
            />
          </div>
        }
      />
      <Kpi
        label="Convergence lag p95"
        value={convergenceLag.p95Seconds}
        unit="s"
        footer={
          <Meta className={withinSlo ? "text-ready" : "text-degraded"}>
            SLO &lt; {convergenceLag.sloSeconds}s ·{" "}
            {withinSlo ? "within budget" : "over budget"}
          </Meta>
        }
      />
      <Kpi
        label="Open drift findings"
        value={drift.open}
        tone={drift.open > 0 ? "text-drift" : "text-fg"}
        footer={
          <Meta className="text-fg-tertiary">
            {drift.open === 0
              ? "no open findings"
              : `across ${drift.tenantsAffected} tenant${drift.tenantsAffected === 1 ? "" : "s"}`}
          </Meta>
        }
      />
      <Kpi
        label="Outbox depth / lag"
        value={outbox.depth}
        unit={` · ${outbox.lagSeconds}s`}
        footer={
          <Meta className={outbox.lagSeconds < 5 ? "text-ready" : "text-degraded"}>
            {outbox.lagSeconds < 5 ? "worker keeping up" : "worker falling behind"}
          </Meta>
        }
      />
    </div>
  );
}
