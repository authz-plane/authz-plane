import type { TenantListFilter } from "./schemas";

/** Query keys per handoff "State Management": ['tenants', filters], ['tenant', slug]. */
export const tenantKeys = {
  all: ["tenants"] as const,
  list: (filter: TenantListFilter) => ["tenants", filter] as const,
  detail: (slug: string) => ["tenant", slug] as const,
  slugCheck: (slug: string) => ["tenants", "slug-check", slug] as const,
};
