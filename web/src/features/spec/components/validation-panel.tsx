"use client";

import { Button } from "@/components/ui/button";
import { DiffBlock, type DiffLine } from "@/components/ui/diff";
import { Skeleton } from "@/components/ui/skeleton";
import { ProblemNotice } from "@/components/states/system-states";
import { cn } from "@/lib/cn";
import type { ValidationIssue, ValidationResponse } from "../schemas";

const LEVEL: Record<ValidationIssue["level"], { glyph: string; fg: string; card: string; word: string }> = {
  ok: { glyph: "✓", fg: "text-ready", card: "border-ready-border bg-ready-tint", word: "ok" },
  warning: { glyph: "⚠", fg: "text-degraded", card: "border-degraded-border bg-degraded-tint", word: "warning" },
  error: { glyph: "✕", fg: "text-failed", card: "border-failed-border bg-failed-tint", word: "error" },
};

export function ResultCard({ issue }: { issue: ValidationIssue }) {
  const s = LEVEL[issue.level];
  return (
    <li className={cn("flex gap-2.5 rounded-[8px] border px-3 py-[11px]", s.card)} data-level={issue.level}>
      <span aria-hidden className={cn("font-mono text-[12px]", s.fg)}>
        {s.glyph}
      </span>
      <span className="sr-only">{s.word}</span>
      <div className="flex min-w-0 flex-col gap-[3px]">
        <span className="text-[12.5px] text-fg">{issue.title}</span>
        <span className="font-mono text-[11px] text-fg-meta">{issue.detail}</span>
      </div>
    </li>
  );
}

/**
 * Frame 05's right pane (400px): Validation header with the mono request
 * caption, result cards, the change preview versus the current generation,
 * and the footer note + "Dry-run plan before saving".
 */
export function ValidationPanel({
  validation,
  validating,
  validationError,
  generation,
  preview,
  dirty,
  onDryRun,
}: {
  validation: ValidationResponse | null;
  validating: boolean;
  validationError: { title: string; detail?: string } | null;
  generation: number;
  preview: DiffLine[];
  dirty: boolean;
  onDryRun: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-1 border-b border-line px-[18px] py-4">
        <h2 className="text-[13.5px] font-semibold text-fg">Validation</h2>
        <span className="font-mono text-[11px] text-fg-meta" role="status">
          POST /spec:validate · {validating ? "…" : validation ? `${validation.durationMs}ms` : "—"}
        </span>
      </div>

      <div className="border-b border-line px-[18px] py-3.5">
        {validationError && <ProblemNotice title={validationError.title} detail={validationError.detail} />}
        {!validationError && validation && (
          <ul className="flex flex-col gap-2.5" aria-label="validation results">
            {validation.results.map((r, i) => (
              <ResultCard key={`${r.title}-${r.line ?? i}`} issue={r} />
            ))}
          </ul>
        )}
        {!validationError && !validation && (
          <div className="flex flex-col gap-2.5" aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[8px] border border-line px-3 py-[11px]">
                <Skeleton className="h-[11px] w-[190px]" />
                <Skeleton className="h-[11px] w-[120px]" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-[18px] py-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13.5px] font-semibold text-fg">Change preview</h2>
          <span className="font-mono text-[11px] text-fg-meta">vs generation {generation}</span>
        </div>
        {dirty ? (
          <div aria-label="change preview">
            <DiffBlock lines={preview} className="max-h-[260px] overflow-auto py-1 text-[12px] leading-[1.9]" />
          </div>
        ) : (
          <p className="rounded-[8px] border border-line px-3 py-2 font-mono text-[11.5px] text-fg-meta">no changes yet · draft matches generation {generation}</p>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <p className="font-mono text-[11px] leading-[1.7] text-fg-meta">
            Saving creates an immutable version and enqueues a reconcile intent in the same transaction. It does not apply anything by itself.
          </p>
          <Button variant="secondary" className="h-9 w-full" onClick={onDryRun}>
            Dry-run plan before saving
          </Button>
        </div>
      </div>
    </>
  );
}
