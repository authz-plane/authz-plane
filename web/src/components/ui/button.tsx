import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "outline" | "drift" | "danger";
type Size = "sm" | "md" | "lg";

/**
 * Handoff "Buttons": hover lightens fill one step or lifts the border, active
 * darkens 4%, focus-visible ring comes from globals.css, disabled is 50%
 * opacity with no pointer events. 120–150ms ease-out on colour only.
 */
const VARIANT: Record<Variant, string> = {
  primary:
    "bg-primary text-ink-on-primary font-semibold hover:bg-primary-hover active:brightness-[0.96]",
  secondary:
    "bg-selected border border-line-control text-fg hover:border-line-disabled active:brightness-[0.96]",
  outline:
    "border border-line-control text-fg-secondary hover:border-line-disabled hover:text-fg active:brightness-[0.96]",
  drift:
    "bg-drift text-[#0B0710] font-semibold hover:brightness-110 active:brightness-[0.96]",
  danger:
    "bg-failed text-[#150607] font-semibold hover:brightness-110 active:brightness-[0.96]",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[12.5px] rounded-control",
  md: "h-10 px-4 text-[13.5px] rounded-control",
  lg: "h-12 px-5 text-[15px] rounded-[9px]",
};

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap select-none transition-[background-color,border-color,color,filter] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}

type ButtonProps = StyleProps & ComponentPropsWithoutRef<"button">;

export function Button({
  variant = "secondary",
  size = "sm",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(BASE, VARIANT[variant], SIZE[size], className)}
      {...rest}
    />
  );
}

type LinkButtonProps = StyleProps &
  Omit<ComponentPropsWithoutRef<typeof Link>, "className"> & {
    /** Plain anchor for route handlers (/api/...) that must not be client-navigated or prefetched. */
    external?: boolean;
  };

export function LinkButton({
  variant = "secondary",
  size = "sm",
  className,
  external,
  href,
  ...rest
}: LinkButtonProps) {
  const classes = cn(BASE, VARIANT[variant], SIZE[size], className);
  if (external) {
    return <a href={String(href)} className={classes} {...rest} />;
  }
  return <Link href={href} className={classes} {...rest} />;
}
