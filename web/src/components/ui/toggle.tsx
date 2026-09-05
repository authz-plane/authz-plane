"use client";

import { cn } from "@/lib/cn";

/**
 * 34×18 track, 14px knob. Off: track #242B36, knob #5A6472. On: track
 * primary, knob near-black ink. Colour-only transition, 150ms.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-[18px] w-[34px] shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-50",
        checked ? "bg-primary" : "bg-line-control",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-[2px] size-[14px] rounded-full transition-[left,background-color] duration-150",
          checked ? "left-[18px] bg-ink-on-primary" : "left-[2px] bg-fg-meta",
        )}
      />
    </button>
  );
}
