import type { RelationsFilter } from "./schemas";

/** Query keys for the relations browser. `all` is what a write invalidates. */
export const relationsKeys = {
  all: (slug: string) => ["relations", slug] as const,
  list: (slug: string, filter: RelationsFilter) => ["relations", slug, filter] as const,
};

/** Playground results depend on tuples; a write invalidates every one of them. */
export const PLAYGROUND_KEY = ["playground"] as const;
