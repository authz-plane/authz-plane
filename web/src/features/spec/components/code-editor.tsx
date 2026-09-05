"use client";

import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { cn } from "@/lib/cn";
import { caretPosition, TOKEN_CLASS, tokenizeYamlLine } from "../highlight";
import type { ValidationIssue } from "../schemas";

/**
 * Frame 05's editor: a 46px right-aligned gutter (#39424F, warning lines in
 * amber, error lines in red) beside 12.5px/1.85 mono code. The visible text is
 * a <pre>-style line renderer; a transparent <textarea> with identical metrics
 * sits over it and owns typing, selection and the caret. Each line carries
 * `white-space: pre`, never the container. Issue rows are full-bleed tinted.
 */
export function CodeEditor({
  value,
  onChange,
  issues,
  readOnly,
  onCaret,
  id,
}: {
  value: string;
  onChange: (next: string) => void;
  issues: ValidationIssue[];
  readOnly?: boolean;
  onCaret?: (pos: { line: number; col: number }) => void;
  id: string;
}) {
  const lines = useMemo(() => value.split("\n"), [value]);
  const issueByLine = useMemo(() => {
    const m = new Map<number, ValidationIssue["level"]>();
    for (const i of issues) {
      if (i.line === null || i.level === "ok") continue;
      const prev = m.get(i.line);
      if (prev !== "error") m.set(i.line, i.level);
    }
    return m;
  }, [issues]);

  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const reportCaret = useCallback(
    (e: SyntheticEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      onCaret?.(caretPosition(el.value, el.selectionStart));
    },
    [onCaret],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab" || readOnly) return;
    // Two spaces, as the status bar promises; never let focus leave the editor on Tab.
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart, selectionEnd } = el;
    const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + 2;
    });
  };

  return (
    <div className="relative flex min-h-0 flex-1 overflow-auto font-mono text-[12.5px] leading-[1.85]" data-focused={focused || undefined}>
      <div aria-hidden className="w-[46px] shrink-0 select-none border-r border-line-row py-3.5 text-right text-line-disabled">
        {lines.map((_, i) => {
          const level = issueByLine.get(i + 1);
          return (
            <div key={i} className={cn("pr-2.5", level === "warning" && "text-degraded", level === "error" && "text-failed")}>
              {i + 1}
            </div>
          );
        })}
      </div>

      <div className="relative min-w-0 flex-1">
        <div aria-hidden className="px-[18px] py-3.5 text-fg-code">
          {lines.map((line, i) => {
            const level = issueByLine.get(i + 1);
            return (
              <div
                key={i}
                className={cn(
                  "whitespace-pre",
                  // Full-bleed issue rows: negative margin + matching padding (frame 05), tinted like diff lines.
                  level === "warning" && "-mx-[18px] bg-diff-changed px-[18px]",
                  level === "error" && "-mx-[18px] bg-diff-removed px-[18px]",
                )}
              >
                {line.length === 0 ? " " : tokenizeYamlLine(line).map((t, k) => (
                  <span key={k} className={TOKEN_CLASS[t.tone]}>
                    {t.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap="off"
          aria-label="tenant.yaml"
          onChange={(e) => {
            onChange(e.target.value);
            reportCaret(e);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={reportCaret}
          onClick={reportCaret}
          onSelect={reportCaret}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 m-0 h-full w-full resize-none overflow-hidden border-0 bg-transparent px-[18px] py-3.5 font-mono text-[12.5px] leading-[1.85] text-transparent caret-fg outline-none selection:bg-line-focus/60 focus-visible:outline-none"
        />
      </div>
    </div>
  );
}
