import { Topbar } from "@/components/layout/topbar";
import { CardSkeleton } from "@/components/states/system-states";

export default function SettingsLoading() {
  return (
    <>
      <Topbar title="Settings" meta="loading…" />
      <div className="flex flex-1 flex-col gap-5 px-7 py-6" aria-busy>
        <CardSkeleton count={3} height={260} />
      </div>
    </>
  );
}
