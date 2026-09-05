import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TONES, type Tone } from "@/lib/phase";

/**
 * Status chip: 10.5px mono, 2×7 padding, radius 5. Always carries its word,
 * never colour alone. Colour transitions animate, layout never does.
 */
export function Chip({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-chip px-[7px] py-[2px] font-mono text-[10.5px] leading-[1.5] transition-colors duration-150",
        t.chipBg,
        t.fg,
        className,
      )}
    >
      {children}
    </span>
  );
}
