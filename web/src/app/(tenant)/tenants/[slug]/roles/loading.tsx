import { SplitBody } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/states/system-states";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";

/** Screen 20 quadrant 2 for the matrix: header stays, rows and inspector become bars. */
export default function RolesLoading() {
  return (
    <>
      <TenantTopbar slug="…" title="Roles & permissions" meta="loading…" />
      <SplitBody
        panelWidth={340}
        panel={
          <div className="flex flex-col gap-3 p-4" aria-busy>
            <Card className="flex flex-col gap-3 p-4">
              <Skeleton className="h-[13px] w-[120px]" />
              <Skeleton className="h-[11px] w-[190px]" />
              <Skeleton className="h-[11px] w-[150px]" />
              <Skeleton className="h-[11px] w-[170px]" />
            </Card>
            <Card className="flex flex-col gap-3 p-4">
              <Skeleton className="h-[13px] w-[88px]" />
              <Skeleton className="h-[11px] w-[240px]" />
            </Card>
          </div>
        }
      >
        <div className="p-6">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-4 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-fg-meta">
              role
            </div>
            <TableSkeleton rows={5} columns={6} />
          </Card>
        </div>
      </SplitBody>
    </>
  );
}
