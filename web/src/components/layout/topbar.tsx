import type { ReactNode } from "react";

/**
 * 60px topbar with a two-line title (sans 16/600 over mono 11 meta) and a
 * right-aligned action group. Padding 0 28px per frame 02.
 */
export function Topbar({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-7">
      <div className="flex flex-col gap-0.5 leading-tight">
        <h1 className="text-[16px] font-semibold text-fg">{title}</h1>
        {meta && (
          <span className="font-mono text-[11px] text-fg-meta">{meta}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </header>
  );
}
