import Link from "next/link";
import { cn } from "@/lib/cn";
import { TONES } from "@/lib/phase";
import { OUTCOME_TONE, shortId } from "@/features/reconcile/lib";
import { OUTCOME_LABELS, type RunSummary } from "@/features/reconcile/schemas";
import { compactAge } from "./countdown";

const TRIGGER_LABEL: Record<RunSummary["trigger"], string> = {
  outbox: "outbox",
  resync: "resync",
  manual: "manual",
  backoff: "backoff",
  delete: "delete",
};

/** Outcome word as frame 04 shows it: "Applied 5" carries the change count. */
function outcomeLabel(run: RunSummary): string {
  if (run.outcome === "Applied" && run.changeOutcomes.length > 0) return `Applied ${run.changeOutcomes.length}`;
  return OUTCOME_LABELS[run.outcome];
}

/** Frame 04's "Recent runs": dot + mono `run 8f1c · gen 9 · outbox` + outcome + age, each row a link to the run. */
export function RecentRuns({ runs, now }: { runs: RunSummary[]; now: string }) {
  const nowMs = Date.parse(now);
  if (runs.length === 0) {
    return <p className="font-mono text-[11.5px] text-fg-meta">no runs yet</p>;
  }
  return (
    <ul className="flex flex-col gap-2" aria-label="recent runs">
      {runs.map((run) => {
        const tone = TONES[OUTCOME_TONE[run.outcome]];
        return (
          <li key={run.id}>
            <Link
              href={`/reconcile-runs/${run.id}`}
              className="flex items-center gap-3 rounded-[8px] border border-line px-3 py-2.5 font-mono text-fg transition-colors duration-[120ms] hover:border-line-disabled hover:bg-hover hover:text-fg"
            >
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", tone.fill)} />
              <span className="min-w-0 flex-1 truncate text-[12px]">
                run {shortId(run.id).slice(0, 4)} · gen {run.generation} · {TRIGGER_LABEL[run.trigger]}
              </span>
              <span className={cn("shrink-0 text-[11.5px]", tone.fg)}>{outcomeLabel(run)}</span>
              <span className="shrink-0 text-[11px] text-fg-meta">{compactAge(run.startedAt, nowMs)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
