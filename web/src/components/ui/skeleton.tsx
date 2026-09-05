import { cn } from "@/lib/cn";

/** Screen 20, quadrant 2: skeletons, never spinners. Widths/heights come from the caller. */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div aria-hidden className={cn("skeleton", className)} style={style} />;
}
