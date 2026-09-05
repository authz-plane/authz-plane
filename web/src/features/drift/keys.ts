import type { DriftListFilter } from "./schemas";

/**
 * Query keys per handoff "State Management" (`['drift', slug]`). The list key
 * carries the scope (tenant or platform) plus the URL filters; `all` is what
 * mutations invalidate. Heal also invalidates `['runs']`, which the reconcile
 * runs feature owns; the constant lives here so this feature does not import
 * from it.
 */
export const driftKeys = {
  all: ["drift"] as const,
  list: (filter: DriftListFilter) =>
    ["drift", { tenant: filter.tenant ?? null, severity: filter.severity ?? null }] as const,
  finding: (id: string) => ["drift", "finding", id] as const,
};

export const RUNS_KEY = ["runs"] as const;
