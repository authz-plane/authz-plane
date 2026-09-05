import type { Consistency } from "./schemas";

/**
 * The playground's result is client state (handoff "State Management": query
 * tuple, options, last result and recent queries are session-only), but the
 * last result is parked in the query cache under these keys so a relations
 * write elsewhere can invalidate `["playground"]` and the visible result
 * re-runs against the new tuple set.
 */
export interface SubmittedQuery {
  slug: string;
  user: string;
  relation: string;
  object: string;
  consistency: Consistency;
  includeProvenance: boolean;
}

export const playgroundKeys = {
  all: ["playground"] as const,
  explain: (query: SubmittedQuery) => ["playground", "explain", query.slug, query] as const,
  batch: (slug: string) => ["playground", "batch", slug] as const,
};
