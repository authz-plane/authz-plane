import { Topbar } from "@/components/layout/topbar";
import { CardSkeleton } from "@/components/states/system-states";
import { Skeleton } from "@/components/ui/skeleton";

export default function AuthorizationLoading() {
  return (
    <>
      <Topbar title="Authorization" meta="loading…" actions={<Skeleton className="h-8 w-[128px] rounded-control" />} />
      <div className="flex flex-1 flex-col gap-5 px-7 py-6" aria-busy>
        <Skeleton className="h-[11px] w-[220px]" />
        <CardSkeleton count={3} height={96} />
        <CardSkeleton count={3} height={96} />
      </div>
    </>
  );
}
