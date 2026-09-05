"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import { OUTCOMES, OutcomeSchema, TRIGGERS, TriggerSchema } from "../schemas";
import type { RunListKeyFilter } from "../keys";

/**
 * The three dropdown pills from frame 08 ("trigger: any ▾" …). Values live in
 * the URL search params so the view is shareable and the server prefetch
 * agrees with the client query key. Changing a filter drops the cursor.
 * Tenant-scoped pages pass `showTenant={false}`.
 */
export function RunFilters({
  filter,
  tenantSlugs,
  showTenant = true,
}: {
  filter: RunListKeyFilter;
  tenantSlugs: string[];
  showTenant?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (name: "trigger" | "outcome" | "tenant", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("cursor");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <>
      <Select
        size="sm"
        aria-label="Filter by trigger"
        className={PILL}
        value={filter.trigger ?? ""}
        onChange={(e) => set("trigger", e.target.value === "" ? "" : TriggerSchema.parse(e.target.value))}
      >
        <option value="">trigger: any</option>
        {TRIGGERS.map((t) => (
          <option key={t} value={t}>
            trigger: {t}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        aria-label="Filter by outcome"
        className={PILL}
        value={filter.outcome ?? ""}
        onChange={(e) => set("outcome", e.target.value === "" ? "" : OutcomeSchema.parse(e.target.value))}
      >
        <option value="">outcome: any</option>
        {OUTCOMES.map((o) => (
          <option key={o} value={o}>
            outcome: {o}
          </option>
        ))}
      </Select>
      {showTenant && (
        <Select
          size="sm"
          aria-label="Filter by tenant"
          className={PILL}
          value={filter.tenant ?? ""}
          onChange={(e) => set("tenant", e.target.value)}
        >
          <option value="">tenant: any</option>
          {tenantSlugs.map((slug) => (
            <option key={slug} value={slug}>
              tenant: {slug}
            </option>
          ))}
        </Select>
      )}
    </>
  );
}

/**
 * Frame 08 pills are 30px tall with 12px secondary text. The shared Select sets
 * h-[34px]/text-[13px]; Tailwind orders same-property utilities alphabetically,
 * so those two need the important suffix to win.
 */
const PILL = "h-[30px]! text-[12px]! text-fg-secondary";
