import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 28px filter pill, radius 6. Active: bg/selected + fg text. Count is mono in
 * the phase colour the caller passes. Renders a Link when href is given so
 * filters live in the URL.
 */
export function FilterPill({
  active,
  href,
  onClick,
  children,
  count,
  countClassName,
  className,
}: {
  active?: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  count?: number | string;
  countClassName?: string;
  className?: string;
}) {
  const classes = cn(
    "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill border px-2.5 text-[12px] transition-colors duration-[120ms]",
    active
      ? "border-line-control bg-selected text-fg"
      : "border-transparent text-fg-tertiary hover:bg-hover hover:text-fg",
    className,
  );
  const inner = (
    <>
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn("font-mono text-[11px] text-fg-meta", countClassName)}>{count}</span>
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-current={active ? "true" : undefined} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={classes}>
      {inner}
    </button>
  );
}

export function FilterDivider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-line" />;
}
