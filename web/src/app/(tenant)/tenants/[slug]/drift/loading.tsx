import { CardSkeleton, TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";

/** Tenant-scoped drift skeleton: one severity select, no tenant select. */
export default function TenantDriftLoading() {
  return (
    <>
      <TenantTopbar
        slug="…"
        title="Drift"
        meta="loading…"
        actions={
          <>
            <Skeleton className="h-[34px] w-[160px] rounded-control" />
            <Skeleton className="h-8 w-[112px] rounded-control" />
            <Skeleton className="h-8 w-[128px] rounded-control" />
          </>
        }
      />
      <div className="flex flex-1 flex-col px-6" aria-busy>
        <div className="py-[18px]">
          <CardSkeleton count={4} height={92} />
        </div>
        <div className="grid grid-cols-[28px_1fr_1.1fr_1.4fr_1.4fr_.7fr_.8fr_92px] gap-3 border-b border-line px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-meta">
          <span />
          <span>tenant</span>
          <span>resource</span>
          <span>desired</span>
          <span>actual</span>
          <span>severity</span>
          <span>detected</span>
          <span />
        </div>
        <TableSkeleton rows={4} columns={7} />
      </div>
    </>
  );
}
