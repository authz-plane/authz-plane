import { cn } from "@/lib/cn";
import { formatDuration, PHASE_TONE_FILL, PHASE_TONE_TEXT } from "../lib";
import type { RunPhase } from "../schemas";

/**
 * Phase waterfall from frame 09: flex-weighted 5px bars butted together (only
 * the outer corners rounded), mono 11px captions beneath. Each bar carries an
 * aria-label with its name and duration; the caption repeats it visibly.
 */
export function PhaseWaterfall({ phases }: { phases: RunPhase[] }) {
  return (
    <ol aria-label="Phase waterfall" className="flex items-stretch font-mono text-[11px]">
      {phases.map((p, i) => {
        const label = `${p.name} · ${formatDuration(p.durationMs)}`;
        return (
          <li key={p.name} className="flex flex-col gap-1.5" style={{ flex: p.weight }}>
            <div
              role="img"
              aria-label={label}
              className={cn(
                "h-[5px] transition-colors duration-150",
                PHASE_TONE_FILL[p.tone],
                i === 0 && "rounded-l-[3px]",
                i === phases.length - 1 && "rounded-r-[3px]",
              )}
            />
            <span aria-hidden className={cn("truncate", PHASE_TONE_TEXT[p.tone])}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
