import { SplitBody } from "@/components/layout/page-header";
import { TableSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";

/** Screen 20 quadrant 2: topbar, filter row and table header stay; rows and the panel become bars. */
export default function RelationsLoading() {
  return (
    <>
      <TenantTopbar slug="…" title="Relations" meta="loading…" />
      <div className="flex items-center gap-2.5 border-b border-line-row px-6 py-4" aria-busy>
        {["user", "relation", "object"].map((k) => (
          <div key={k} className="flex h-[34px] flex-1 items-center gap-2 rounded-control border border-line-control px-3 font-mono text-[12px] text-fg-meta">
            {k}
          </div>
        ))}
        <Skeleton className="h-[34px] w-[64px]" />
      </div>
      <SplitBody
        panelWidth={380}
        panel={
          <div className="flex flex-col gap-3 p-[18px]" aria-busy>
            <Skeleton className="h-[13px] w-[88px]" />
            <Skeleton className="h-[120px] w-full" />
            <Skeleton className="h-[11px] w-[240px]" />
            <Skeleton className="h-[11px] w-[190px]" />
          </div>
        }
      >
        <div className="px-6">
          <div className="grid grid-cols-[1.2fr_.8fr_1.2fr_.9fr_.9fr_34px] gap-3 border-b border-line px-3 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-meta">
            <span>user</span>
            <span>relation</span>
            <span>object</span>
            <span>source</span>
            <span>written</span>
            <span />
          </div>
          <TableSkeleton rows={6} columns={5} />
        </div>
      </SplitBody>
    </>
  );
}
