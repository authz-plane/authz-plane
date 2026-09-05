import { SplitBody } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";

/** Screen 20 quadrant 2: topbar and tab strip stay; gutter numbers and code lines become bars. */
export default function SpecEditorLoading() {
  const widths = [190, 120, 74, 150, 170, 60, 220, 88, 260, 150, 120, 300, 74, 190, 240, 60, 88, 170, 150, 120];
  return (
    <>
      <TenantTopbar slug="…" title="Desired state spec" />
      <SplitBody
        panelWidth={400}
        panel={
          <div className="flex flex-col gap-3 p-[18px]" aria-busy>
            <Skeleton className="h-[11px] w-[80px]" />
            <Skeleton className="h-[11px] w-[160px]" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[8px] border border-line px-3 py-[11px]">
                <Skeleton className="h-[11px] w-[190px]" />
                <Skeleton className="h-[11px] w-[120px]" />
              </div>
            ))}
          </div>
        }
      >
        <div className="flex h-[38px] shrink-0 items-center gap-4 border-b border-line px-6 text-[12.5px] text-fg">
          <span className="border-b-2 border-primary py-2.5">tenant.yaml</span>
          <span className="text-fg-tertiary">form view</span>
          <span className="ml-auto font-mono text-[11px] text-fg-meta">YAML · loading…</span>
        </div>
        <div className="flex flex-1 font-mono text-[12.5px] leading-[1.85]" aria-busy>
          <div className="w-[46px] border-r border-line-row py-3.5 pr-2.5 text-right text-line-disabled">
            {widths.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <div className="flex flex-col gap-[12px] px-[18px] py-4">
            {widths.map((w, i) => (
              <Skeleton key={i} className="h-[11px]" style={{ width: w, marginLeft: i % 4 === 3 ? 48 : i % 4 === 2 ? 32 : i % 4 === 1 ? 16 : 0 }} />
            ))}
          </div>
        </div>
      </SplitBody>
    </>
  );
}
