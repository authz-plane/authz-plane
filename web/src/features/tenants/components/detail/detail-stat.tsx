import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * Frame 04's stat tile is smaller than the dashboard KPI card: 14px padding,
 * 11.5px label, 22px mono number, 11px mono meta. Local to the detail screen
 * because the shared StatCard is fixed at the 30px KPI size.
 */
export function DetailStat({ label, value, tone, meta }: { label: string; value: ReactNode; tone?: string; meta: ReactNode }) {
  return (
    <Card className="flex flex-col gap-[7px] p-3.5">
      <span className="text-[11.5px] text-fg-tertiary">{label}</span>
      <span className={cn("font-mono text-[22px] leading-none tabular-nums transition-colors duration-150", tone ?? "text-fg")}>{value}</span>
      <span className="font-mono text-[11px] text-fg-meta">{meta}</span>
    </Card>
  );
}
