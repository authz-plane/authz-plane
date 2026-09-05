import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/**
 * 4-up stat tile: 12px label, 30px mono number (line-height 1), one mono
 * meta line or a custom footer. `tone` colours the number; `tint` colours the
 * whole card (screen 10's purple "Open" tile).
 */
export function StatCard({
  label,
  value,
  unit,
  tone,
  tint,
  footer,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  tone?: string;
  tint?: string;
  footer?: ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col gap-2.5 p-4", tint)}>
      <span className="text-[12px] text-fg-tertiary">{label}</span>
      <span
        className={cn(
          "font-mono text-[30px] leading-none tabular-nums transition-colors duration-150",
          tone ?? "text-fg",
        )}
      >
        {value}
        {unit !== undefined && <span className="text-[14px] text-fg-meta">{unit}</span>}
      </span>
      {footer}
    </Card>
  );
}

export function StatMeta({ className, children }: { className?: string; children: ReactNode }) {
  return <span className={cn("font-mono text-[11px] leading-[1.5] text-fg-tertiary", className)}>{children}</span>;
}
