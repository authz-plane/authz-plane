import { Topbar } from "@/components/layout/topbar";
import { CardSkeleton, TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";

/** Screen 20, quadrant 2: topbar stays, stats and rows skeleton in. */
export default function ReconcileRunsLoading() {
  return (
    <>
      <Topbar
        title="Reconcile runs"
        meta="loading…"
        actions={
          <>
            <Skeleton className="h-[30px] w-[104px] rounded-control" />
            <Skeleton className="h-[30px] w-[112px] rounded-control" />
            <Skeleton className="h-[30px] w-[100px] rounded-control" />
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
