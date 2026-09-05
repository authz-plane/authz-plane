import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONES, type Tone } from "@/lib/phase";

const GLYPH: Record<Tone, string> = {
  neutral: "ⓘ",
  link: "ⓘ",
  ready: "✓",
  degraded: "⚠",
  failed: "✕",
  drift: "◆",
};

/**
 * Tinted alert strip (screen 04's amber "Not converged"). Title on the left
 * with a glyph, optional mono detail line beneath, actions on the right.
 */
export function AlertStrip({
  tone,
  title,
  detail,
  actions,
  className,
}: {
  tone: Tone;
  title: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "failed" || tone === "degraded" ? "alert" : "status"}
      className={cn("flex items-center justify-between gap-4 rounded-inner border px-4 py-3", t.border, t.tint, className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <div className={cn("flex items-center gap-2 text-[13px] font-medium", t.fg)}>
          <span aria-hidden className="font-mono">{GLYPH[tone]}</span>
          <span className="text-fg">{title}</span>
        </div>
        {detail && <div className="truncate font-mono text-[11.5px] text-fg-secondary">{detail}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
