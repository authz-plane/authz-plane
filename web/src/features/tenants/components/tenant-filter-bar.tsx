import Link from "next/link";
import { FilterDivider, FilterPill } from "@/components/ui/filter-pill";
import { cn } from "@/lib/cn";
import { TONES, toneForPhase } from "@/lib/phase";
import { PAGE_SIZE, tenantListHref } from "../filters";
import type { Phase, TenantListFilter, TenantPage } from "../schemas";

/** The phase pills frame 03 shows, in order. Counts render in the phase colour. */
const PHASE_PILLS: readonly Phase[] = ["Ready", "Applying", "Degraded", "Failed"];

/**
 * Filter row: count pills (URL links, never client-side filtering), a
 * divider, the drift pill in its own colour, and the mono cursor caption.
 */
export function TenantFilterBar({
  filter,
  counts,
}: {
  filter: TenantListFilter;
  counts: TenantPage["counts"];
}) {
  const driftActive = Boolean(filter.hasDrift);
  return (
    <nav
      aria-label="Filter tenants"
      className="flex shrink-0 items-center gap-2 border-b border-line-row px-7 py-4"
    >
      <FilterPill href={tenantListHref(filter, { phase: undefined })} active={!filter.phase} count={counts.all}>
        All
      </FilterPill>
      {PHASE_PILLS.map((phase) => (
        <FilterPill
          key={phase}
          href={tenantListHref(filter, { phase })}
          active={filter.phase === phase}
          count={counts.byPhase[phase] ?? 0}
          countClassName={TONES[toneForPhase(phase)].fg}
        >
          {phase}
        </FilterPill>
      ))}
      <FilterDivider />
      <Link
        href={tenantListHref(filter, { hasDrift: driftActive ? undefined : true })}
        aria-current={driftActive ? "true" : undefined}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-pill border border-drift-border px-2.5 text-[12px] text-drift transition-colors duration-[120ms] hover:bg-drift-tint hover:text-drift",
          driftActive && "bg-drift-tint",
        )}
      >
        <span>Has open drift</span>
        <span className="font-mono text-[11px]">{counts.withDrift}</span>
      </Link>
      <span className="ml-auto font-mono text-[11px] text-fg-meta">
        {filter.cursor ? `cursor after ${filter.cursor}` : "cursor page 1"} · {PAGE_SIZE} per page
      </span>
    </nav>
  );
}
