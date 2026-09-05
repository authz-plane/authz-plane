import { Topbar } from "@/components/layout/topbar";
import { CardSkeleton, TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";

/** Tenant-scoped variant of the runs skeleton: two filter pills, no tenant pill. */
export default function TenantReconcileRunsLoading() {
  return (
    <>
      <Topbar
        title="Reconcile runs"
        meta="loading…"
        actions={
          <>
            <Skeleton className="h-[30px] w-[104px] rounded-control" />
            <Skeleton className="h-[30px] w-[112px] rounded-control" />
          </>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-7 py-[18px]" aria-busy>
        <CardSkeleton count={4} height={92} />
        <TableSkeleton rows={8} columns={7} />
      </div>
    </>
  );
}
