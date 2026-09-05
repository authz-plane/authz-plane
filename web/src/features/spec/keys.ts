/**
 * Query keys per handoff "State Management": ['spec', slug, generation]. The
 * current document sits under 'current' so a spec write can invalidate every
 * ['spec', slug, …] entry at once; plans key on the draft's content hash.
 */
export const specKeys = {
  all: (slug: string) => ["spec", slug] as const,
  current: (slug: string) => ["spec", slug, "current"] as const,
  versions: (slug: string) => ["spec", slug, "versions"] as const,
  plan: (slug: string, draftHash: string) => ["plan", slug, draftHash] as const,
};
