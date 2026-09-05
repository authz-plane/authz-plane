import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { SSRF_POLICY } from "@/features/identity-providers/probe";

/** Screen 20 quadrant 2 for the connections screen: both headers and the SSRF footer stay. */
export default function IdentityProvidersLoading() {
  return (
    <div className="flex min-h-0 flex-1" aria-busy>
      <aside className="flex w-[420px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-5">
          <h1 className="text-[15px] font-semibold text-fg">Connections</h1>
        </div>
        <div className="flex flex-col gap-2.5 p-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col gap-3 rounded-card border border-line p-3.5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-[13px] w-[120px]" />
                <Skeleton className="h-[16px] w-[74px]" />
              </div>
              <Skeleton className="h-[11px] w-[190px]" />
              <Skeleton className="h-[11px] w-[150px]" />
            </div>
          ))}
        </div>
        <div className="mt-auto flex flex-col gap-2 border-t border-line p-4">
          <Eyebrow>SSRF guard</Eyebrow>
          <p className="font-mono text-[11px] leading-[1.75] text-fg-tertiary">{SSRF_POLICY}</p>
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-6">
          <Skeleton className="h-[15px] w-[110px]" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-[112px] rounded-control" />
            <Skeleton className="h-8 w-[120px] rounded-control" />
          </div>
        </header>
        <div className="flex flex-col gap-[18px] p-6">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-[7px]">
                <Skeleton className="h-[11px] w-[52px]" />
                <Skeleton className="h-[38px] rounded-[8px]" />
              </div>
            ))}
            <div className="col-span-2 flex flex-col gap-[7px]">
              <Skeleton className="h-[11px] w-[52px]" />
              <Skeleton className="h-[38px] rounded-[8px]" />
            </div>
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col gap-[7px]">
                <Skeleton className="h-[11px] w-[88px]" />
                <Skeleton className="h-[38px] rounded-[8px]" />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2.5">
            <Eyebrow>Claim mappings</Eyebrow>
            <Skeleton className="h-[120px] rounded-inner" />
          </div>
          <Card className="flex flex-col gap-3 p-4">
            <Skeleton className="h-[13px] w-[150px]" />
            {[170, 190, 150, 120].map((w) => (
              <Skeleton key={w} className="h-[11px]" style={{ width: w }} />
            ))}
          </Card>
        </div>
      </section>
    </div>
  );
}
