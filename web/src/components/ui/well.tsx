import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Code / log well: bg/inset, 12.5px mono, line-height 1.85, code text colour.
 * Put white-space:pre on each line, never the container (handoff screen 05).
 */
export function Well({ className, children, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "rounded-inner border border-line bg-inset px-3.5 py-3 font-mono text-[12.5px] leading-[1.85] text-fg-code",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function WellLine({
  children,
  className,
  indent = 0,
}: {
  children: ReactNode;
  className?: string;
  indent?: number;
}) {
  return (
    <div
      className={cn("whitespace-pre", className)}
      style={indent ? { paddingLeft: indent * 16 } : undefined}
    >
      {children}
    </div>
  );
}

/** Label/value rows for "facts" lists (run facts, provenance, context). */
export function FactList({
  items,
  labelWidth = 120,
  className,
}: {
  items: Array<{ label: string; value: ReactNode; tone?: string }>;
  labelWidth?: number;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col gap-2 font-mono text-[11.5px]", className)}>
      {items.map((it) => (
        <div key={it.label} className="flex gap-3">
          <dt className="shrink-0 text-fg-meta" style={{ width: labelWidth }}>
            {it.label}
          </dt>
          <dd className={cn("min-w-0 break-all text-fg-code", it.tone)}>{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
