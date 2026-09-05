"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { SEVERITIES, SeveritySchema, type DriftListFilter } from "../schemas";

/**
 * Tenant + severity filters. Both live in the URL (handoff: filters and
 * cursor are in the query string so views are shareable). Changing a filter
 * also leaves any open drawer, since the finding may no longer be in view.
 */
export function DriftFilters({
  basePath,
  filter,
  tenants,
  scopedTenant,
}: {
  basePath: string;
  filter: DriftListFilter;
  tenants: string[];
  /** when set, the tenant select is hidden and never written to the URL */
  scopedTenant?: string;
}) {
  const router = useRouter();

  const apply = (next: DriftListFilter) => {
    const params = new URLSearchParams();
    if (!scopedTenant && next.tenant) params.set("tenant", next.tenant);
    if (next.severity) params.set("severity", next.severity);
    const qs = params.toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath);
  };

  return (
    <div className="flex items-center gap-2">
      {!scopedTenant && (
        <label className="flex items-center gap-2 text-[12px] text-fg-tertiary">
          <span className="sr-only">Tenant</span>
          <Select
            size="sm"
            mono
            aria-label="Filter by tenant"
            value={filter.tenant ?? ""}
            onChange={(e) => apply({ ...filter, tenant: e.target.value || undefined })}
            className="w-[200px]"
          >
            <option value="">tenant: any</option>
            {tenants.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </label>
      )}
      <label className="flex items-center gap-2 text-[12px] text-fg-tertiary">
        <span className="sr-only">Severity</span>
        <Select
          size="sm"
          mono
          aria-label="Filter by severity"
          value={filter.severity ?? ""}
          onChange={(e) => {
            const parsed = SeveritySchema.safeParse(e.target.value);
            apply({ ...filter, severity: parsed.success ? parsed.data : undefined });
          }}
          className="w-[160px]"
        >
          <option value="">severity: any</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}
