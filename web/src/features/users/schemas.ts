import { z } from "zod";

/**
 * Wire shapes for /api/tenants/[slug]/users. Users are a read-only mirror of
 * the IdP: the console never edits a record. Roles come from the spec (staged
 * ones marked), tuple counts from OpenFGA, and `unmanaged` means the subject
 * holds tuples that desired state does not know about.
 */

export const UserRoleStateSchema = z.enum(["applied", "staged", "drift"]);
export type UserRoleState = z.infer<typeof UserRoleStateSchema>;

export const UserRoleSchema = z.object({
  name: z.string(),
  state: UserRoleStateSchema,
});
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserStateSchema = z.enum(["active", "unmanaged"]);
export type UserState = z.infer<typeof UserStateSchema>;

export const UserRecordSchema = z.object({
  id: z.string(),
  /** OpenFGA subject, e.g. "user:ana" */
  subject: z.string(),
  /** null for an external subject the IdP has no profile for */
  name: z.string().nullable(),
  email: z.string(),
  roles: z.array(UserRoleSchema),
  tupleCount: z.number().int().nonnegative(),
  /** tuples staged for deletion in the next generation */
  pendingDeletes: z.number().int().nonnegative(),
  state: UserStateSchema,
  lastSeenAt: z.string().nullable(),
});
export type UserRecord = z.infer<typeof UserRecordSchema>;

export const UsersFilterSchema = z.object({
  q: z.string().min(1).optional(),
});
export type UsersFilter = z.infer<typeof UsersFilterSchema>;

/** Normalise raw search params so query keys compare equal. */
export function parseUsersFilter(params: Record<string, string | string[] | undefined>): UsersFilter {
  const raw = params.q;
  const q = typeof raw === "string" ? raw.trim() : "";
  return UsersFilterSchema.parse(q ? { q } : {});
}

export const USERS_PAGE_SIZE = 8;

export const UsersPageSchema = z.object({
  items: z.array(UserRecordSchema),
  nextCursor: z.string().nullable(),
  /** users in the mirror (matching ones when filtered) */
  total: z.number().int().nonnegative(),
  /** the tenant's full user count, for the "312 users" caption */
  userCount: z.number().int().nonnegative(),
  lastRefreshedAt: z.string(),
  /** reconcile run that last refreshed the mirror */
  lastRefreshRunId: z.string(),
  /** the instant the server answered; relative ages are computed against it */
  asOf: z.string(),
  /** generation staged roles belong to */
  stagedGeneration: z.number().int().positive(),
  /** roles an invite may grant (spec roles, staged marker stripped) */
  inviteRoles: z.array(z.string()),
});
export type UsersPage = z.infer<typeof UsersPageSchema>;

export const RefreshResultSchema = z.object({
  runId: z.string(),
  enqueuedAt: z.string(),
});
export type RefreshResult = z.infer<typeof RefreshResultSchema>;

export const InviteRequestSchema = z.object({
  email: z.email().max(254),
  role: z.string().trim().min(1).max(64),
});
export type InviteRequest = z.infer<typeof InviteRequestSchema>;

export const InviteResultSchema = z.object({
  inviteId: z.string(),
  email: z.string(),
  role: z.string(),
  expiresAt: z.string(),
});
export type InviteResult = z.infer<typeof InviteResultSchema>;
