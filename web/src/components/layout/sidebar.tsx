import { Eyebrow } from "@/components/ui/eyebrow";
import { Wordmark } from "@/components/ui/logo-mark";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";
import type { DependencyStatus, ShellSummary } from "@/features/dashboard/schemas";
import type { Session } from "@/server/session";
import { NavItem } from "./nav-item";

const DEPENDENCY_TONE: Record<DependencyStatus, string> = {
  ok: "text-ready",
  degraded: "text-degraded",
  down: "text-failed",
};

/** Platform-level sidebar from frame 02: 236px, bg/nav, nav list, dependencies card, user row. */
export function Sidebar({
  summary,
  operator,
}: {
  summary: ShellSummary;
  operator: Session;
}) {
  return (
    <aside className="flex w-[236px] shrink-0 flex-col gap-[22px] border-r border-line bg-nav px-3.5 py-[18px]">
      <div className="px-2">
        <Wordmark />
      </div>

      <nav aria-label="Platform" className="flex flex-col gap-0.5">
        <NavItem href="/dashboard">Overview</NavItem>
        <NavItem href="/tenants">Tenants</NavItem>
        <NavItem href="/reconcile-runs" count={summary.nav.reconcileRuns}>
          Reconcile runs
        </NavItem>
        <NavItem
          href="/drift"
          count={summary.nav.drift}
          countClassName={summary.nav.drift > 0 ? "text-drift" : undefined}
        >
          Drift
        </NavItem>
        <NavItem href="/authorization">Authorization</NavItem>
        <NavItem href="/playground">Playground</NavItem>
        <NavItem href="/audit">Audit</NavItem>
        <NavItem href="/settings">Settings</NavItem>
      </nav>

      <section
        aria-label="Dependencies"
        className="mt-auto flex flex-col gap-2.5 rounded-inner border border-line bg-inset p-3"
      >
        <Eyebrow>Dependencies</Eyebrow>
        <ul className="flex flex-col gap-[7px] text-[12px] text-fg-secondary">
          {summary.dependencies.map((dep) => (
            <li key={dep.name} className="flex justify-between">
              <span>{dep.name}</span>
              <span className={cn(DEPENDENCY_TONE[dep.status])}>
                {dep.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-[9px] border-t border-line p-2">
        <div
          aria-hidden
          className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-line-control text-[11px] text-fg-secondary"
        >
          {initialsOf(operator.name)}
        </div>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[12.5px] text-fg">{operator.name}</span>
          <span className="truncate text-[11px] text-fg-meta">
            {operator.role}
          </span>
        </div>
        <form action="/api/auth/logout" method="post" className="ml-auto">
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            className="rounded-[5px] px-1.5 py-0.5 font-mono text-[12px] text-fg-meta transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
          >
            ⦸
          </button>
        </form>
      </div>
    </aside>
  );
}
