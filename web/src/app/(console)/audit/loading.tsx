import { SplitBody } from "@/components/layout/page-header";
import { Topbar } from "@/components/layout/topbar";
import { TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";

/** Platform audit skeleton: tenant pill plus the two filter pills; TENANT column in the header. */
export default function AuditLoading() {
  return (
    <>
      <Topbar
        title="Audit"
        meta="loading…"
        actions={
          <>
            <Skeleton className="h-[30px] w-[132px] rounded-control" />
            <Skeleton className="h-[30px] w-[120px] rounded-control" />
            <Skeleton className="h-[30px] w-[124px] rounded-control" />
            <Skeleton className="h-[30px] w-[128px] rounded-control" />
          </>
        }
      />
      <SplitBody
        panelWidth={400}
        panel={
          <div className="flex flex-col gap-3 p-[18px]" aria-busy>
            <Skeleton className="h-[18px] w-[92px]" />
            <Skeleton className="h-[13px] w-[240px]" />
            <Skeleton className="h-[11px] w-[200px]" />
            <Skeleton className="mt-3 h-[120px] w-full" />
            <Skeleton className="h-[11px] w-[190px]" />
            <Skeleton className="h-[11px] w-[150px]" />
          </div>
        }
      >
        <div className="px-6">
          <div className="grid grid-cols-[.9fr_.9fr_1.1fr_1.2fr_1.5fr_.8fr] gap-3 border-b border-line px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-meta">
            <span>time</span>
            <span>tenant</span>
            <span>actor</span>
            <span>action</span>
            <span>resource</span>
            <span>request</span>
          </div>
          <TableSkeleton rows={8} columns={6} />
        </div>
      </SplitBody>
    </>
  );
}
