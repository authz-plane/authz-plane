import { Topbar } from "@/components/layout/topbar";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Screen 20, quadrant 2: keep the topbar, stream the shell, skeleton the
 * cards. Bars are 11px with staggered widths; no spinner anywhere.
 */
export default function DashboardLoading() {
  return (
    <>
      <Topbar title="Platform overview" meta="loading…" />
      <div className="flex flex-1 flex-col gap-5 px-7 py-6" aria-busy>
        <div className="grid grid-cols-4 gap-3.5">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} className="flex h-[112px] flex-col gap-3 p-4">
              <Skeleton className="h-[11px] w-[92px]" />
              <Skeleton className="h-[26px] w-[64px]" />
              <Skeleton className="h-[11px] w-[120px]" />
            </Card>
          ))}
        </div>
        <div className="grid flex-1 grid-cols-[1.55fr_1fr] gap-3.5">
          <Card className="flex flex-col gap-4 p-[18px]">
            <Skeleton className="h-[11px] w-[150px]" />
            <div className="flex h-[150px] items-end gap-1.5">
              {[74, 60, 88, 52, 96, 70, 120, 88, 104, 76, 130, 112].map(
                (h, i) => (
                  <Skeleton key={i} className="flex-1" style={{ height: h }} />
                ),
              )}
            </div>
            <Skeleton className="h-[11px] w-[190px]" />
          </Card>
          <Card className="flex flex-col gap-3.5 p-[18px]">
            <Skeleton className="h-[11px] w-[120px]" />
            {[150, 190, 120, 170].map((w, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 rounded-[8px] border border-line p-3"
              >
                <Skeleton className="h-[11px]" style={{ width: w }} />
                <Skeleton className="h-[11px] w-[74%]" />
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
