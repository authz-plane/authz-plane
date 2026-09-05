import type { RunListFilterInput } from "./schemas";

/** Filter object with only the defined keys, so server prefetch and client query hash identically. */
export type RunListKeyFilter = Pick<RunListFilterInput, "trigger" | "outcome" | "tenant" | "cursor">;

export function normalizeRunFilter(filter: RunListKeyFilter): RunListKeyFilter {
  const out: RunListKeyFilter = {};
  if (filter.trigger) out.trigger = filter.trigger;
  if (filter.outcome) out.outcome = filter.outcome;
  if (filter.tenant) out.tenant = filter.tenant;
  if (filter.cursor) out.cursor = filter.cursor;
  return out;
}

/** Query keys per handoff "State Management": ['runs', filters], ['run', runId]. */
export const runKeys = {
  all: ["runs"] as const,
  list: (filter: RunListKeyFilter) => ["runs", normalizeRunFilter(filter)] as const,
  detail: (runId: string) => ["run", runId] as const,
};
