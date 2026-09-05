"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/input";
import { AUDIT_ACTIONS, AuditActionSchema, type Actor, type AuditFilter } from "../schemas";

/**
 * Frame 17's "actor: any ▾" / "action: any ▾" pills (30px, 12px secondary
 * text), plus a tenant pill on the platform page. Values live in the URL so
 * views are shareable; changing a filter drops the selected event and the
 * cursor, since neither survives a different result set.
 */
export function AuditFilters({
  filter,
  actors,
  tenants,
}: {
  filter: AuditFilter;
  actors: Actor[];
  /** when provided the tenant pill is shown (platform page) */
  tenants?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const set = (name: "tenant" | "actor" | "action", value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(name, value);
    else params.delete(name);
    params.delete("event");
    params.delete("cursor");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <>
      {tenants && (
        <Select
          size="sm"
          mono
          aria-label="Filter by tenant"
          className={PILL}
          value={filter.tenant ?? ""}
          onChange={(e) => set("tenant", e.target.value)}
        >
          <option value="">tenant: any</option>
          {tenants.map((slug) => (
            <option key={slug} value={slug}>
              tenant: {slug}
            </option>
          ))}
        </Select>
      )}
      <Select
        size="sm"
        mono
        aria-label="Filter by actor"
        className={PILL}
        value={filter.actor ?? ""}
        onChange={(e) => set("actor", e.target.value)}
      >
        <option value="">actor: any</option>
        {actors.map((a) => (
          <option key={a.id} value={a.id}>
            actor: {a.label}
          </option>
        ))}
      </Select>
      <Select
        size="sm"
        mono
        aria-label="Filter by action"
        className={PILL}
        value={filter.action ?? ""}
        onChange={(e) => set("action", e.target.value === "" ? "" : AuditActionSchema.parse(e.target.value))}
      >
        <option value="">action: any</option>
        {AUDIT_ACTIONS.map((a) => (
          <option key={a} value={a}>
            action: {a}
          </option>
        ))}
      </Select>
    </>
  );
}

/** The shared Select is 34px/12.5px; frame 17 pills are 30px/12px, so those two need the important suffix to win. */
const PILL = "h-[30px]! text-[12px]! text-fg-secondary";
