import { cn } from "@/lib/cn";
import { TONES, toneForPhase } from "@/lib/phase";
import type { Phase } from "@/features/tenants/schemas";
import { lifecycleChain } from "./lifecycle";

/**
 * Chip chain from frame 04: 11px mono chips, 5×9 padding, radius 6. The
 * current phase carries its tone, a strong border and a "current" caption;
 * every other chip is dimmed. Arrows: → for transitions made, ⇢ for pending.
 */
export function LifecycleChain({ phase }: { phase: Phase }) {
  const steps = lifecycleChain(phase);
  return (
    <ol className="flex flex-wrap items-start gap-1.5 font-mono text-[11px]" aria-label="lifecycle">
      {steps.map((s) => {
        const t = TONES[toneForPhase(s.phase)];
        return (
          <li key={s.phase} className="flex items-start gap-1.5">
            <div className="flex flex-col items-center gap-1">
              <span
                aria-current={s.current ? "step" : undefined}
                className={cn(
                  "rounded-pill border px-[9px] py-[5px] leading-none transition-colors duration-150",
                  s.current ? cn(t.chipBg, t.fg, s.phase === "Degraded" ? "border-degraded-border-strong" : s.phase === "Failed" ? "border-failed-border-strong" : t.border) : "border-transparent bg-hover text-fg-meta",
                )}
              >
                {s.phase}
              </span>
              {s.current && <span className="text-[10px] uppercase tracking-[0.12em] text-fg-meta">current</span>}
            </div>
            {s.arrow && (
              <span aria-hidden className="pt-[5px] text-line-disabled">
                {s.arrow}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
