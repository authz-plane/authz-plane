import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";

/** Screen 20 quadrant 2 for the playground: both headers stay, the form and tree become bars. */
export default function PlaygroundLoading() {
  return (
    <div className="flex min-h-0 flex-1" aria-busy>
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-[60px] shrink-0 items-center border-b border-line px-[18px]">
          <h1 className="text-[15px] font-semibold text-fg">Ask a question</h1>
        </div>
        <div className="flex flex-col gap-3.5 p-[18px]">
          {["Tenant", "User", "Relation", "Object"].map((label) => (
            <div key={label} className="flex flex-col gap-[7px]">
              <Eyebrow>{label}</Eyebrow>
              <Skeleton className="h-[38px] rounded-[8px]" />
            </div>
          ))}
          <div className="flex flex-col gap-[9px] rounded-inner border border-line bg-inset p-3.5">
            <Eyebrow>Options</Eyebrow>
            {[150, 190, 120].map((w) => (
              <Skeleton key={w} className="h-[11px]" style={{ width: w }} />
            ))}
          </div>
          <Skeleton className="h-[42px] rounded-[8px]" />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[26px] w-[88px] rounded-control" />
            <Skeleton className="h-[11px] w-[240px]" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-[30px] w-[100px] rounded-control" />
            <Skeleton className="h-[30px] w-[84px] rounded-control" />
          </div>
        </header>
        <div className="flex flex-col gap-[18px] p-6">
          <div className="flex flex-col gap-3">
            <Eyebrow>Resolution tree</Eyebrow>
            {[0, 28, 28, 28, 56].map((indent, i) => (
              <Skeleton key={i} className="h-[42px] rounded-inner" style={{ marginLeft: indent }} />
            ))}
          </div>
          <Skeleton className="h-[92px] rounded-card" />
          <div className="flex gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="flex flex-1 flex-col gap-2 p-3.5">
                <Skeleton className="h-[11px] w-[92px]" />
                <Skeleton className="h-[18px] w-[40px]" />
              </Card>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
