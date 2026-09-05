import { Topbar } from "@/components/layout/topbar";
import { TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";
import { Table } from "@/components/ui/table";
import { TENANT_COLUMNS, TenantTableHeader } from "@/features/tenants/components/tenant-table";

/** Screen 20, quadrant 2: topbar and table header stay visible, rows skeleton in. */
export default function TenantsLoading() {
  return (
    <>
      <Topbar
        title="Tenants"
        meta="loading…"
        actions={
          <>
            <Skeleton className="h-8 w-[260px] rounded-control" />
            <Skeleton className="h-8 w-[104px] rounded-control" />
          </>
        }
      />
      <div className="flex shrink-0 items-center gap-2 border-b border-line-row px-7 py-4" aria-hidden>
        {[52, 74, 84, 88, 68].map((w, i) => (
          <Skeleton key={i} className="h-7 rounded-pill" style={{ width: w }} />
        ))}
        <Skeleton className="ml-auto h-[11px] w-[150px]" />
      </div>
      <div className="flex flex-1 flex-col px-7" aria-busy>
        <Table columns={TENANT_COLUMNS} minWidth={980}>
          <TenantTableHeader />
        </Table>
        <TableSkeleton rows={7} columns={6} />
      </div>
    </>
  );
}
