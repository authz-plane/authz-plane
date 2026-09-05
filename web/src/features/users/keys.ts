import type { UsersFilter } from "./schemas";

/** Query keys per handoff "State Management": `['users', slug]`, filter + cursor beneath it. */
export const usersKeys = {
  all: (slug: string) => ["users", slug] as const,
  list: (slug: string, filter: UsersFilter) => ["users", slug, filter] as const,
};
