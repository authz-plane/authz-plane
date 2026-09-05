import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

/**
 * Inputs: 34–40px tall, control border #242B36, focused border #2E3A55 on
 * bg #0D1219. Mono when they hold identifiers (pass `mono`).
 */
const CONTROL =
  "w-full rounded-control border border-line-control bg-transparent px-3 text-[13px] text-fg placeholder:text-fg-meta outline-none transition-colors duration-150 hover:border-line-disabled focus:border-line-focus focus:bg-input-focus-bg disabled:cursor-not-allowed disabled:opacity-50";

type InputProps = Omit<ComponentPropsWithoutRef<"input">, "size"> & {
  mono?: boolean;
  size?: "sm" | "md";
  invalid?: boolean;
};

export function Input({ className, mono, size = "md", invalid, ...rest }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        CONTROL,
        size === "sm" ? "h-[34px]" : "h-10",
        mono && "font-mono text-[12.5px]",
        invalid && "border-failed-border-strong",
        className,
      )}
      {...rest}
    />
  );
}

type SelectProps = Omit<ComponentPropsWithoutRef<"select">, "size"> & {
  mono?: boolean;
  size?: "sm" | "md";
};

export function Select({ className, mono, size = "md", children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          CONTROL,
          "cursor-pointer appearance-none pr-8",
          size === "sm" ? "h-[34px]" : "h-10",
          mono && "font-mono text-[12.5px]",
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-fg-meta"
      >
        ▾
      </span>
    </div>
  );
}

type TextareaProps = ComponentPropsWithoutRef<"textarea"> & { mono?: boolean };

export function Textarea({ className, mono = true, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        CONTROL,
        "min-h-[120px] resize-y py-2 leading-[1.85]",
        mono && "font-mono text-[12.5px]",
        className,
      )}
      {...rest}
    />
  );
}

/** Label + control + optional hint, stacked with 6px gap. */
export function Field({
  label,
  hint,
  htmlFor,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[12px] text-fg-tertiary">
        {label}
      </label>
      {children}
      {hint && <div className="font-mono text-[11px] text-fg-meta">{hint}</div>}
    </div>
  );
}
