import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Screen 20 quadrant 2: topbar and column captions stay; code lines and graph cards are bars. */
export default function AuthorizationModelLoading() {
  return (
    <>
      <TenantTopbar slug="…" title="Authorization model" />
      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr]" aria-busy>
        <section className="flex flex-col border-r border-line">
          <div className="flex justify-between border-b border-line-row px-[18px] py-2.5 font-mono text-[11px] text-fg-meta">
            <span>model.fga</span>
            <span>loading…</span>
          </div>
          <div className="flex flex-col gap-3 px-5 py-4">
            {[150, 190, 60, 120, 60, 170, 74, 220, 260, 60, 150, 88, 240, 300, 320].map((w, i) => (
              <Skeleton key={i} className="h-[11px]" style={{ width: w, marginLeft: i % 3 === 2 ? 32 : i % 3 === 1 ? 16 : 0 }} />
            ))}
          </div>
        </section>
        <aside className="flex flex-col bg-panel">
          <div className="border-b border-line-row px-[18px] py-2.5 font-mono text-[11px] text-fg-meta">TYPE GRAPH</div>
          <div className="flex flex-col gap-4 p-6">
            {[0, 1].map((i) => (
              <Card key={i} className="flex flex-col gap-3 p-4">
                <Skeleton className="h-[22px] w-[92px]" />
                <Skeleton className="h-[11px] w-[240px]" />
                <Skeleton className="h-[11px] w-[180px]" />
                <Skeleton className="h-[11px] w-[120px]" />
              </Card>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
