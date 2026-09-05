import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Grid-based table matching the handoff: header row 10.5px mono uppercase
 * with .12em tracking and 12px padding; body rows 13–14px padding on a 1px
 * #14191F divider; active row bg/card; hover bg/hover. Columns come from a
 * grid-template-columns string, e.g. "1.5fr .8fr .9fr .7fr 1fr .8fr 40px".
 * Tables never wrap: the wrapper scrolls horizontally.
 */
export function Table({
  columns,
  className,
  children,
  minWidth,
  ...rest
}: ComponentPropsWithoutRef<"div"> & {
  columns: string;
  minWidth?: number;
}) {
  return (
    <div className={cn("overflow-x-auto", className)} {...rest}>
      <div
        role="table"
        style={{ "--cols": columns, minWidth } as CSSProperties}
        className="flex flex-col"
      >
        {children}
      </div>
    </div>
  );
}

const ROW_GRID = "grid grid-cols-[var(--cols)] items-center gap-3";

export function TableHead({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="rowgroup">
      <div
        role="row"
        className={cn(
          ROW_GRID,
          "border-b border-line px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-meta",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function TableBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="rowgroup" className={cn("flex flex-col", className)}>
      {children}
    </div>
  );
}

type RowProps = ComponentPropsWithoutRef<"div"> & {
  active?: boolean;
  /** tinted rows (drift, selected) pass their own bg classes */
  tint?: string;
  interactive?: boolean;
};

export function TableRow({ active, tint, interactive, className, children, ...rest }: RowProps) {
  return (
    <div
      role="row"
      className={cn(
        ROW_GRID,
        "border-b border-line-row px-4 py-[13px] text-[13px] text-fg transition-colors duration-[120ms]",
        active && "bg-card",
        tint,
        interactive && "cursor-pointer hover:bg-hover",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function TableCell({
  className,
  children,
  mono,
  ...rest
}: ComponentPropsWithoutRef<"div"> & { mono?: boolean }) {
  return (
    <div
      role="cell"
      className={cn("min-w-0 truncate", mono && "font-mono text-[12.5px]", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function TableHeaderCell({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div role="columnheader" className={cn("min-w-0 truncate", className)} {...rest}>
      {children}
    </div>
  );
}

/** 52px footer: left summary, right pager or actions. */
export function TableFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-[52px] items-center justify-between px-4 font-mono text-[11px] text-fg-meta",
        className,
      )}
    >
      {children}
    </div>
  );
}
