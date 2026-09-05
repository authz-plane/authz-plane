import { Skeleton } from "@/components/ui/skeleton";

/** Screen 20 quadrant 2: the 320px version column and the two pane captions stay; cards and lines are bars. */
export default function SpecVersionsLoading() {
  const lines = [60, 150, 170, 220, 74, 150, 190, 120, 60, 88, 150, 170];
  return (
    <div className="flex min-h-0 flex-1" aria-busy>
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-[60px] items-center justify-between border-b border-line px-[18px]">
          <span className="text-[14px] font-semibold text-fg">Versions</span>
          <span className="font-mono text-[11px] text-fg-meta">loading…</span>
        </div>
        <div className="flex flex-col gap-2 p-2.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col gap-2 rounded-inner border border-line p-3">
              <Skeleton className="h-[11px] w-[74px]" />
              <Skeleton className="h-[11px] w-[190px]" />
              <Skeleton className="h-[11px] w-[150px]" />
            </div>
          ))}
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[60px] items-center gap-2.5 border-b border-line px-6">
          <Skeleton className="h-[22px] w-[74px]" />
          <Skeleton className="h-[22px] w-[74px]" />
          <Skeleton className="h-[11px] w-[120px]" />
        </div>
        <div className="flex flex-1 font-mono text-[11px] tracking-[0.12em] text-fg-tertiary">
          {["SIDE A", "SIDE B"].map((label) => (
            <div key={label} className="flex flex-1 flex-col border-r border-line last:border-r-0">
              <div className="border-b border-line-row px-[18px] py-[9px]">{label}</div>
              <div className="flex flex-col gap-[14px] px-[18px] py-4">
                {lines.map((w, i) => (
                  <Skeleton key={i} className="h-[11px]" style={{ width: w, marginLeft: i % 3 === 2 ? 32 : i % 3 === 1 ? 16 : 0 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
