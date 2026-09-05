import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton } from "@/components/states/system-states";

/** Screen 20 quadrant 2: the 76px header stays; strip, stat tiles and the two cards are bars. */
export default function TenantDetailLoading() {
  return (
    <>
      <PageHeader title={<Skeleton className="h-[18px] w-[160px]" />} meta="loading…" />
      <PageBody className="gap-4 py-5" aria-busy>
        <Skeleton className="h-[64px] w-full rounded-inner" />
        <CardSkeleton count={4} height={92} />
        <div className="grid flex-1 grid-cols-2 gap-3">
          <Card className="flex flex-col gap-3.5 p-4">
            <Skeleton className="h-[11px] w-[74px]" />
            <div className="flex gap-1.5">
              {[60, 66, 62, 68, 52].map((w, i) => (
                <Skeleton key={i} className="h-[22px]" style={{ width: w }} />
              ))}
            </div>
            <Skeleton className="h-[11px] w-[88px]" />
            {[150, 190, 170].map((w, i) => (
              <div key={i} className="flex items-center gap-3 rounded-[8px] border border-line px-3 py-3">
                <Skeleton className="h-[11px]" style={{ width: w }} />
                <Skeleton className="ml-auto h-[11px] w-[74px]" />
              </div>
            ))}
          </Card>
          <Card className="flex flex-col gap-3 p-4">
            <Skeleton className="h-[11px] w-[150px]" />
            {[120, 170, 74, 60, 88].map((w, i) => (
              <div key={i} className="flex justify-between border-b border-selected py-2.5">
                <Skeleton className="h-[11px]" style={{ width: w }} />
                <Skeleton className="h-[11px] w-[120px]" />
              </div>
            ))}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
