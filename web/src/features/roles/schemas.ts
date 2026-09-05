import { z } from "zod";

/**
 * Wire shapes for /api/tenants/[slug]/roles. Roles are spec-owned: the matrix
 * is a projection of the desired-state spec, and every edit stages a spec
 * change rather than writing to the authorization store.
 */

export const PermissionSchema = z.enum([
  "tenant.read",
  "tenant.write",
  "relations.write",
  "audit.read",
  "idp.manage",
]);
export type Permission = z.infer<typeof PermissionSchema>;
export const PERMISSIONS = PermissionSchema.options;

export const RoleSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]*$/),
  users: z.number().int().nonnegative(),
  permissions: z.array(PermissionSchema),
  /** relation tuples that reference this role; > 0 blocks deletion (409) */
  boundTuples: z.number().int().nonnegative(),
  source: z.object({
    kind: z.literal("spec"),
    generation: z.number().int().positive(),
  }),
  /** defined in a generation the reconciler has not applied yet */
  staged: z.boolean(),
  /** days since a check last resolved through this role; null while in use */
  unusedDays: z.number().int().nonnegative().nullable(),
});
export type Role = z.infer<typeof RoleSchema>;

export const RolesResponseSchema = z.object({
  slug: z.string(),
  items: z.array(RoleSchema),
  /** current desired generation of the spec the roles come from */
  specGeneration: z.number().int().positive(),
});
export type RolesResponse = z.infer<typeof RolesResponseSchema>;

export const RoleDeleteResultSchema = z.object({
  key: z.string(),
  /** the spec generation the removal was staged into */
  generation: z.number().int().positive(),
  stagedAt: z.string(),
});
export type RoleDeleteResult = z.infer<typeof RoleDeleteResultSchema>;
