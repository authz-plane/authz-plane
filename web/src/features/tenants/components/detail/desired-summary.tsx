import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { groupThousands } from "@/lib/format";
import type { TenantDetail } from "@/features/tenants/schemas";

/** Frame 04's "Desired state summary": definition rows over a drift callout footer. */
export function DesiredSummary({ tenant }: { tenant: TenantDetail }) {
  const d = tenant.desired;
  const rows: Array<[string, string]> = [
    ["Identity providers", `${d.identityProviders.length} · ${d.identityProviders.join(", ") || "none"}`],
    ["Authorization model", d.modelSummary],
    ["Roles", d.roles.join(", ") || "none"],
    ["Managed users", `${groupThousands(d.userCount)} mirrored`],
    ["Reconcile policy", d.policy],
  ];
  return (
    <Card className="flex min-h-0 flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <CardTitle>Desired state summary</CardTitle>
        <Link href={`/tenants/${tenant.slug}/spec`} className="font-mono text-[11px] text-link">
          view spec ↗
        </Link>
      </div>
      <dl className="flex flex-col text-[12.5px] text-fg-secondary">
        {rows.map(([label, value], i) => (
          <div key={label} className={i < rows.length - 1 ? "flex justify-between gap-4 border-b border-selected py-[9px] first:pt-0" : "flex justify-between gap-4 pt-[9px]"}>
            <dt>{label}</dt>
            <dd className="min-w-0 truncate text-right font-mono text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      {tenant.openDrift > 0 ? (
        <div className="mt-auto flex items-center gap-2.5 rounded-[8px] border border-drift-border bg-drift-tint p-3">
          <span aria-hidden className="font-mono text-drift">
            ◆
          </span>
          <span className="flex-1 text-[12.5px] text-fg-secondary">
            {tenant.openDrift} open drift finding{tenant.openDrift === 1 ? "" : "s"} on this tenant
          </span>
          <Link href={`/tenants/${tenant.slug}/drift`} className="font-mono text-[12px] text-drift hover:text-drift">
            Review →
          </Link>
        </div>
      ) : (
        <p className="mt-auto font-mono text-[11px] text-fg-meta">no open drift · actual matches desired</p>
      )}
    </Card>
  );
}
