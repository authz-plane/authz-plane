import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/** bg/card on a 1px primary border, radius 10. Padding is the caller's choice (14–18px per spec). */
export function Card({ className, ...rest }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("rounded-card border border-line bg-card", className)}
      {...rest}
    />
  );
}

export function CardTitle({
  className,
  ...rest
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={cn("text-[13.5px] font-semibold leading-tight text-fg", className)}
      {...rest}
    />
  );
}
