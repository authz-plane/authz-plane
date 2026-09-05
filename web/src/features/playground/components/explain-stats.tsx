import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { ExplainResponse } from "@/features/playground/schemas";

/**
 * Footer 4-up (frame 15): 11.5px label over an 18px mono value. The shared
 * StatCard renders a 30px KPI number, which is the dashboard scale, not this
 * frame's, so this is a feature-local tile. Cache carries a word, not just
 * the amber.
 */
function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <Card className="flex flex-1 flex-col gap-1.5 p-3.5">
      <span className="text-[11.5px] text-fg-tertiary">{label}</span>
      <span className={cn("font-mono text-[18px] leading-none tabular-nums", tone ?? "text-fg")}>{value}</span>
    </Card>
  );
}

export function ExplainStats({ result }: { result: ExplainResponse }) {
  const s = result.stats;
  return (
    <div className="flex gap-3">
      <Stat label="Nodes evaluated" value={s.nodesEvaluated} />
      <Stat
        label="Max depth"
        value={
          <>
            {s.maxDepth} <span className={cn("text-[11px]", s.depthCapHit ? "text-degraded" : "text-fg-meta")}>/ {s.depthCap} cap</span>
          </>
        }
      />
      <Stat label="FGA calls" value={s.fgaCalls} />
      <Stat
        label="Cache"
        value={result.cached ? "hit" : "bypassed"}
        tone={result.cached ? "text-ready" : "text-degraded"}
      />
    </div>
  );
}
