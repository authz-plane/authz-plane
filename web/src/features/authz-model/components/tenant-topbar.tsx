import type { ReactNode } from "react";

/**
 * 60px tenant-section topbar from frames 12–14: mono breadcrumb "slug /",
 * 15px/600 title, optional chip or mono meta, actions right. Padding 0 24px.
 * Lives under the authz-model feature because the shared layout primitives
 * (Topbar/PageHeader) have no breadcrumb + chip variant at this height; the
 * roles and relations screens import it from here.
 */
export function TenantTopbar({
  slug,
  title,
  chip,
  meta,
  actions,
}: {
  slug: string;
  title: string;
  chip?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="font-mono text-[12px] text-fg-tertiary">{slug} /</span>
        <h1 className="truncate text-[15px] font-semibold leading-tight text-fg">{title}</h1>
        {chip}
        {meta && <span className="font-mono text-[11px] text-fg-meta">{meta}</span>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
