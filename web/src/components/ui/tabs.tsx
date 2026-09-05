import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 38px tab strip: active tab has a 2px primary underline and fg text;
 * inactive is tertiary. Right slot for mono captions ("YAML · 62 lines").
 */
export function TabStrip({
  tabs,
  right,
  className,
}: {
  tabs: Array<{ label: string; href?: string; active?: boolean; onClick?: () => void }>;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn("flex h-[38px] items-stretch justify-between border-b border-line px-4", className)}
    >
      <div className="flex items-stretch gap-4">
        {tabs.map((t) => {
          const classes = cn(
            "inline-flex items-center border-b-2 text-[13px] transition-colors duration-[120ms]",
            t.active ? "border-primary text-fg" : "border-transparent text-fg-tertiary hover:text-fg",
          );
          return t.href ? (
            <Link key={t.label} role="tab" aria-selected={t.active} href={t.href} className={classes}>
              {t.label}
            </Link>
          ) : (
            <button key={t.label} role="tab" type="button" aria-selected={t.active} onClick={t.onClick} className={classes}>
              {t.label}
            </button>
          );
        })}
      </div>
      {right && <div className="flex items-center font-mono text-[11px] text-fg-meta">{right}</div>}
    </div>
  );
}
