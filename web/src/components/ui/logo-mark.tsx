import { cn } from "@/lib/cn";

/**
 * The mark is a CSS square with mono "az": 24px in the sidebar, 30px on the
 * sign-in page. No image asset exists by design.
 */
export function LogoMark({ size = 24 }: { size?: 24 | 30 }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex items-center justify-center bg-primary font-mono font-semibold text-ink-on-primary",
        size === 30
          ? "size-[30px] rounded-[8px] text-[14px]"
          : "size-6 rounded-[6px] text-[12px]",
      )}
    >
      az
    </div>
  );
}

export function Wordmark({
  size = 24,
}: {
  size?: 24 | 30;
}) {
  return (
    <div className={cn("flex items-center", size === 30 ? "gap-3" : "gap-2.5")}>
      <LogoMark size={size} />
      <span
        className={cn(
          "font-mono tracking-[0.02em] text-fg",
          size === 30 ? "text-[15px]" : "text-[13px]",
        )}
      >
        authz-plane
      </span>
    </div>
  );
}
