import { TableSkeleton } from "@/components/states/system-states";
import { Chip } from "@/components/ui/chip";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";

/** Screen 20 quadrant 2 for the mirror: topbar, search row and table header stay; rows become bars. */
export default function UsersLoading() {
  return (
    <>
      <TenantTopbar slug="…" title="Users" chip={<Chip tone="neutral">read-only mirror</Chip>} />
      <div className="flex shrink-0 items-center gap-3 border-b border-line-row px-6 py-4" aria-busy>
        <Skeleton className="h-8 w-[300px] rounded-control" />
        <Skeleton className="ml-auto h-[11px] w-[280px]" />
      </div>
      <div className="px-6">
        <div className="grid grid-cols-[1.6fr_1.2fr_1fr_1fr_.8fr] gap-3 border-b border-line px-3 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-meta">
          <span>user</span>
          <span>subject</span>
          <span>roles</span>
          <span>tuples</span>
          <span>state</span>
        </div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    </>
  );
}
