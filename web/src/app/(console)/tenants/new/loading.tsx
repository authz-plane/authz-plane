import { SplitBody } from "@/components/layout/page-header";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { StepRail } from "@/features/tenants/components/step-rail";

/** Header and panel eyebrow stay; fields and the YAML well skeleton in. */
export default function NewTenantLoading() {
  return (
    <>
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-6">
        <h1 className="text-[15px] font-semibold text-fg">New tenant</h1>
        <StepRail current="identity" />
      </header>
      <SplitBody
        panelWidth={400}
        panel={
          <div className="flex flex-1 flex-col gap-3.5 p-6" aria-busy>
            <Eyebrow>Spec preview · generation 1</Eyebrow>
            <div className="flex flex-1 flex-col gap-3 rounded-inner border border-line bg-inset p-3.5">
              {[150, 90, 70, 120, 160, 60, 130, 110, 150, 120].map((w, i) => (
                <Skeleton key={i} className="h-[11px]" style={{ width: w }} />
              ))}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-[22px] px-10 py-8" aria-busy>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[20px] w-[110px]" />
            <Skeleton className="h-[11px] w-[420px]" />
          </div>
          <div className="grid max-w-[620px] grid-cols-2 gap-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <div className="col-span-2 flex gap-2.5">
              <Skeleton className="h-[62px] flex-1 rounded-inner" />
              <Skeleton className="h-[62px] flex-1 rounded-inner" />
              <Skeleton className="h-[62px] flex-1 rounded-inner" />
            </div>
            <Skeleton className="col-span-2 h-[118px] rounded-card" />
          </div>
        </div>
      </SplitBody>
    </>
  );
}
