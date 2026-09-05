import { cn } from "@/lib/cn";

export type DiffKind = "added" | "removed" | "changed" | "context";

export interface DiffLine {
  kind: DiffKind;
  text: string;
  /** optional line number for the gutter */
  n?: number;
}

const LINE: Record<DiffKind, { row: string; glyph: string; glyphTone: string }> = {
  added: { row: "bg-ready-tint", glyph: "+", glyphTone: "text-ready" },
  removed: { row: "bg-diff-removed", glyph: "−", glyphTone: "text-failed" },
  changed: { row: "bg-diff-changed", glyph: "~", glyphTone: "text-degraded" },
  context: { row: "", glyph: " ", glyphTone: "text-fg-meta" },
};

/**
 * Diff block from the handoff: each line is full-bleed tinted with its glyph,
 * unchanged lines dimmed. Tints are the ready-tint / diff-removed /
 * diff-changed tokens. Every line carries a glyph, so colour is never alone.
 */
export function DiffBlock({
  lines,
  className,
  dimContext = true,
  gutter = false,
}: {
  lines: DiffLine[];
  className?: string;
  dimContext?: boolean;
  gutter?: boolean;
}) {
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-inner border border-line bg-inset py-2 font-mono text-[12.5px] leading-[1.85]",
        className,
      )}
    >
      {lines.map((l, i) => {
        const s = LINE[l.kind];
        return (
          <div
            key={i}
            className={cn(
              "flex whitespace-pre px-3.5",
              s.row,
              l.kind === "context" && dimContext ? "text-fg-meta" : "text-fg-code",
            )}
          >
            {gutter && (
              <span className="w-[38px] shrink-0 select-none pr-3 text-right text-line-disabled">
                {l.n ?? ""}
              </span>
            )}
            <span aria-label={l.kind === "context" ? undefined : l.kind} className={cn("w-4 shrink-0", s.glyphTone)}>
              {s.glyph}
            </span>
            <span>{l.text}</span>
          </div>
        );
      })}
    </div>
  );
}
