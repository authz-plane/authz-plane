/** Query keys for the authorization model screen. */
export const authzModelKeys = {
  all: (slug: string) => ["authz-model", slug] as const,
  model: (slug: string) => ["authz-model", slug, "model"] as const,
};
