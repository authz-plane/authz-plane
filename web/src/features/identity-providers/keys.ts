/** Query keys for the identity-providers screen. Staging an edit invalidates `all` plus the tenant / spec / runs keys. */
export const idpKeys = {
  all: (slug: string) => ["identity-providers", slug] as const,
  list: (slug: string) => ["identity-providers", slug, "list"] as const,
  one: (slug: string, id: string) => ["identity-providers", slug, id] as const,
};

/** Handoff "Invalidation": a spec write invalidates tenant, spec versions and runs. */
export function specWriteKeys(slug: string): ReadonlyArray<readonly unknown[]> {
  return [["tenant", slug], ["spec", slug], ["runs"]];
}
