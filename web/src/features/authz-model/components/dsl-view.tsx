import { cn } from "@/lib/cn";
import { diffDsl, tokenize, type TokenKind } from "../dsl";

/**
 * Syntax colours from frame 12: keywords tertiary, type names drift, relation
 * names link, operators degraded, numbers accent. Lines the draft adds over the
 * live model are full-bleed ready-tinted with a "+" glyph in the gutter, so the
 * change is never carried by colour alone.
 */
const KIND_CLASS: Partial<Record<TokenKind, string>> = {
  keyword: "text-fg-tertiary",
  type: "text-drift",
  relation: "text-link",
  operator: "text-degraded",
  number: "text-accent",
  comment: "text-fg-meta",
};

export function DslView({ live, draft, className }: { live: string; draft: string; className?: string }) {
  const lines = tokenize(draft);
  const { added } = diffDsl(live, draft);
  return (
    <pre
      data-testid="dsl-view"
      className={cn(
        "m-0 min-h-0 flex-1 overflow-auto px-5 py-4 font-mono text-[13px] leading-[2] text-fg-code",
        className,
      )}
    >
      {lines.map((line) => {
        const isAdded = added.has(line.n);
        // The "+" takes the first indent column so added lines stay aligned.
        const indent = isAdded && line.indent.length > 0 ? line.indent.slice(1) : line.indent;
        return (
          <div
            key={line.n}
            data-line={line.n}
            data-added={isAdded || undefined}
            className={cn("whitespace-pre", isAdded && "-mx-5 bg-ready-tint px-5")}
          >
            {isAdded && (
              <span aria-label="added" className="text-ready">
                +
              </span>
            )}
            {indent}
            {line.tokens.map((t, i) => {
              const cls = KIND_CLASS[t.kind];
              return cls ? (
                <span key={i} data-kind={t.kind} className={cls}>
                  {t.text}
                </span>
              ) : (
                <span key={i} data-kind={t.kind}>
                  {t.text}
                </span>
              );
            })}
            {line.tokens.length === 0 && indent === "" && " "}
          </div>
        );
      })}
    </pre>
  );
}
