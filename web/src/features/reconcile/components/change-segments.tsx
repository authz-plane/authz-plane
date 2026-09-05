import { cn } from "@/lib/cn";
import { TONES } from "@/lib/phase";
import { changesCell } from "../lib";
import type { RunSummary } from "../schemas";

/**
 * CHANGES column from frame 08: 24×5px segments, radius 3, 5px gap, one per
 * change coloured by outcome, then a mono caption ("3/5", "4 drift",
 * "attempt 8/8"). The container carries a full-sentence aria-label so the
 * state is never colour alone; the segments themselves are decorative.
 */
export function ChangeSegments({ run }: { run: RunSummary }) {
  const cell = changesCell(run);
  if (cell.kind === "text") {
    // Frame 08 sets "no changes" in the meta colour, one step dimmer than the neutral tone.
    return <span className={cn("font-mono text-[12px]", cell.tone === "neutral" ? "text-fg-meta" : TONES[cell.tone].fg)}>{cell.text}</span>;
  }
  return (
    <div role="img" aria-label={cell.label} className="flex items-center gap-[5px]">
      {cell.segments.map((s, i) => (
        <span
          key={i}
          aria-hidden
          data-outcome={s.outcome}
          className={cn("h-[5px] w-6 shrink-0 rounded-[3px] transition-colors duration-150", TONES[s.tone].fill)}
        />
      ))}
      <span
        aria-hidden
        className={cn(
          "ml-1.5 font-mono text-[12px]",
          cell.captionTone === "neutral" ? "text-fg-meta" : TONES[cell.captionTone].fg,
        )}
      >
        {cell.caption}
      </span>
    </div>
  );
}
