import { PageBody, PageHeader, SplitBody } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Header shell stays visible; waterfall, change rows and the right panel skeleton in. */
export default function RunDetailLoading() {
  return (
    <>
      <PageHeader
        breadcrumb={<span className="font-mono text-[11px]">Reconcile runs /</span>}
        title={<Skeleton className="h-[18px] w-[140px]" />}
        meta={<Skeleton className="h-[11px] w-[420px]" />}
        actions={
          <>
            <Skeleton className="h-8 w-[104px] rounded-control" />
            <Skeleton className="h-8 w-[140px] rounded-control" />
            <Skeleton className="h-8 w-[92px] rounded-control" />
          </>
        }
      />
      <SplitBody
        panelWidth={340}
        panel={
          <div className="flex flex-col gap-3 p-[18px]" aria-busy>
            <Skeleton className="h-[11px] w-[74px]" />
            {[150, 120, 170, 190, 88, 60].map((w, i) => (
              <Skeleton key={i} className="h-[11px]" style={{ width: w }} />
            ))}
          </div>
        }
      >
        <PageBody className="gap-4 py-[22px]">
          <div className="flex gap-0.5" aria-busy aria-label="Loading">
            {[1, 2, 3, 2].map((flex, i) => (
              <Skeleton key={i} className="h-[5px]" style={{ flex }} />
            ))}
          </div>
          <Skeleton className="h-[11px] w-[74px]" />
          {[150, 190, 120, 170, 88].map((w, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-inner border border-line px-3.5 py-[13px]">
              <Skeleton className="h-[11px] w-[28px]" />
              <Skeleton className="h-[11px] w-[120px]" />
              <Skeleton className="h-[11px]" style={{ width: w }} />
              <Skeleton className="ml-auto h-[11px] w-[52px]" />
            </div>
          ))}
        </PageBody>
      </SplitBody>
    </>
  );
}
