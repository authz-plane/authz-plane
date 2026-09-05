import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** Eyebrow label: 10.5px mono, .14em tracking, uppercase, meta colour. */
export function Eyebrow({ className, ...rest }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-meta",
        className,
      )}
      {...rest}
    />
  );
}
