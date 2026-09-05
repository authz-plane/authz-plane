import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * 76px detail header (frame 04 / 09): breadcrumb or name + chip on the first
 * line, mono meta on the second, actions right. Use Topbar for the 60px
 * single-title variant.
 */
export function PageHeader({
  breadcrumb,
  title,
  chip,
  meta,
  actions,
  className,
}: {
  breadcrumb?: ReactNode;
  title: ReactNode;
  chip?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-line px-7",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1 leading-tight">
        <div className="flex items-center gap-2.5">
          {breadcrumb && <span className="text-[13px] text-fg-tertiary">{breadcrumb}</span>}
          <h1 className="truncate text-[18px] font-semibold text-fg">{title}</h1>
          {chip}
        </div>
        {meta && <div className="truncate font-mono text-[11px] text-fg-meta">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </header>
  );
}

/** Body wrapper: 24px vertical, 28px horizontal padding, owns scroll. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-7 py-6", className)}>{children}</div>;
}

/** Content + right panel split. Panel widths per screen: 320/340/380/400/420. */
export function SplitBody({
  children,
  panel,
  panelWidth = 340,
  className,
}: {
  children: ReactNode;
  panel: ReactNode;
  panelWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">{children}</div>
      <aside
        className="flex min-h-0 shrink-0 flex-col overflow-auto border-l border-line bg-panel"
        style={{ width: panelWidth }}
      >
        {panel}
      </aside>
    </div>
  );
}
