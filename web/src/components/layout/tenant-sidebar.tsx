import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { Wordmark } from "@/components/ui/logo-mark";
import { toneForPhase } from "@/lib/phase";
import type { TenantSummary } from "@/features/tenants/schemas";
import { NavItem } from "./nav-item";

/**
 * Tenant-scoped sidebar from frame 04: "← Tenants", tenant card (name, mono
 * slug, phase chip), then the tenant's sections with live counts.
 */
export function TenantSidebar({
  tenant,
  counts,
}: {
  tenant: TenantSummary;
  counts: { reconcileRuns: number; drift: number };
}) {
  const base = `/tenants/${tenant.slug}`;
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-4 border-r border-line bg-nav px-3.5 py-[18px]">
      <div className="px-2">
        <Wordmark />
      </div>
      <Link
        href="/tenants"
        className="px-2.5 text-[12.5px] text-fg-tertiary transition-colors duration-[120ms] hover:text-fg"
      >
        ← Tenants
      </Link>
      <div className="flex flex-col gap-1.5 rounded-inner border border-line bg-inset p-3">
        <span className="truncate text-[13.5px] font-semibold text-fg">{tenant.displayName}</span>
        <span className="truncate font-mono text-[11.5px] text-fg-meta">{tenant.slug}</span>
        <div>
          <Chip tone={toneForPhase(tenant.phase)}>{tenant.phase}</Chip>
        </div>
      </div>
      <nav aria-label={`${tenant.displayName} sections`} className="flex flex-col gap-0.5">
        <NavItem href={base} exact>
          Overview
        </NavItem>
        <NavItem href={`${base}/spec`}>Spec</NavItem>
        <NavItem href={`${base}/identity-providers`}>Identity providers</NavItem>
        <NavItem href={`${base}/authorization-model`}>Authorization model</NavItem>
        <NavItem href={`${base}/roles`}>Roles &amp; permissions</NavItem>
        <NavItem href={`${base}/relations`}>Relations</NavItem>
        <NavItem href={`${base}/users`}>Users</NavItem>
        <NavItem href={`${base}/reconcile-runs`} count={counts.reconcileRuns}>
          Reconcile runs
        </NavItem>
        <NavItem href={`${base}/drift`} count={counts.drift} countClassName={counts.drift > 0 ? "text-drift" : undefined}>
          Drift
        </NavItem>
        <NavItem href={`${base}/audit-events`}>Audit</NavItem>
      </nav>
    </aside>
  );
}
