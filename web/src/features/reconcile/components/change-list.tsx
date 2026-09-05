import { cn } from "@/lib/cn";
import { CHANGE_GLYPH, formatMillis, shortId } from "../lib";
import type { ChangeError, ChangeOutcome, RunChange } from "../schemas";

/**
 * "Changes" from frame 09. Success rows are green-tinted cards; the failed
 * change expands into a red card with the problem+json well; skipped and
 * pending rows are dashed and dimmed. Every row leads with a glyph and its
 * index so the outcome never rests on colour alone.
 */

const ROW_STYLE: Record<ChangeOutcome, { card: string; glyph: string; text: string }> = {
  applied: { card: "border-ready-border bg-ready-tint-deep", glyph: "text-ready", text: "text-fg" },
  failed: { card: "border-failed-border-strong bg-failed-tint-deep", glyph: "text-failed", text: "text-fg" },
  retrying: { card: "border-degraded-border-strong bg-degraded-tint-deep", glyph: "text-degraded", text: "text-fg" },
  applying: { card: "border-link-border bg-link-tint", glyph: "text-link", text: "text-fg" },
  pending: { card: "border-dashed border-line-control", glyph: "text-fg-meta", text: "text-fg-meta" },
  skipped: { card: "border-dashed border-line-control", glyph: "text-fg-meta", text: "text-fg-meta" },
};

function ChangeRow({ change }: { change: RunChange }) {
  const s = ROW_STYLE[change.outcome];
  const dim = change.outcome === "skipped" || change.outcome === "pending";
  const noteTone = change.outcome === "failed" ? "text-failed" : change.outcome === "applying" ? "text-link" : "text-fg-meta";
  return (
    <div className="flex items-center gap-3.5 font-mono text-[12.5px]">
      <span className={cn("w-9 shrink-0 whitespace-nowrap", s.glyph)}>
        <span aria-hidden>{CHANGE_GLYPH[change.outcome]}</span>
        <span className="sr-only">{change.outcome}</span> {change.index}
      </span>
      <span className={cn("w-[120px] shrink-0 truncate", dim ? "text-fg-meta" : "text-fg-secondary")}>{change.kind}</span>
      <span className={cn("min-w-0 flex-1 truncate", s.text)}>{change.description}</span>
      <span className={cn("truncate", noteTone)}>{change.note ?? "—"}</span>
      {!dim && <span className="shrink-0 text-fg-secondary tabular-nums">{formatMillis(change.durationMs)}</span>}
    </div>
  );
}

/**
 * problem+json well inside the failed card: bg/inset, 11.5px mono, 1.7 line
 * height, no border (frame 09). Local rather than the shared Well because its
 * type ramp differs and same-property utilities cannot override each other.
 */
function ProblemWell({ error }: { error: ChangeError }) {
  const retry =
    error.nextRetrySeconds === null
      ? "no further attempts"
      : `next ${error.nextRetrySeconds}s (jittered)`;
  return (
    <div className="rounded-control bg-inset px-3 py-[11px] font-mono text-[11.5px] leading-[1.7] text-fg-secondary">
      <div className="whitespace-pre-wrap">problem+json · type: {error.type}</div>
      <div className="whitespace-pre-wrap">
        changeKey: <span title={error.changeKey}>{shortId(error.changeKey)}</span> · attempt {error.attempt} of {error.maxAttempts} · {retry}
      </div>
      <div className="whitespace-pre-wrap">detail: {error.detail}</div>
    </div>
  );
}

export function ChangeList({ changes }: { changes: RunChange[] }) {
  if (changes.length === 0) {
    return (
      <p className="rounded-inner border border-dashed border-line-control px-3.5 py-[13px] font-mono text-[12.5px] text-fg-meta">
        · no changes planned — actual state already matched desired
      </p>
    );
  }
  return (
    <ol aria-label="Changes" className="flex flex-col gap-2">
      {changes.map((c) => {
        const s = ROW_STYLE[c.outcome];
        const expanded = c.outcome === "failed" && c.error;
        return (
          <li
            key={c.index}
            data-outcome={c.outcome}
            className={cn(
              "rounded-inner border transition-colors duration-150",
              s.card,
              expanded ? "flex flex-col gap-2.5 p-3.5" : "px-3.5 py-[13px]",
            )}
          >
            <ChangeRow change={c} />
            {expanded && c.error && <ProblemWell error={c.error} />}
          </li>
        );
      })}
    </ol>
  );
}
