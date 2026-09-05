/** Query keys for the roles matrix. */
export const rolesKeys = {
  list: (slug: string) => ["roles", slug] as const,
};
