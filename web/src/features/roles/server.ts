import "server-only";

import { getTenant } from "@/features/tenants/server";
import { acmeRoles, genericRoles } from "./fixtures";
import {
  RoleDeleteResultSchema,
  RolesResponseSchema,
  type Role,
  type RoleDeleteResult,
  type RolesResponse,
} from "./schemas";

/**
 * Server-side role access. Pages and /api/tenants/[slug]/roles handlers share
 * these. Fixtures until AuthzPlane.Api exposes the spec's role projection.
 *
 * Deletions mutate a module-level Map so the matrix reacts; the store resets
 * when the server process restarts.
 */

type Failure = { ok: false; status: number; title: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

const store = new Map<string, Role[]>();

async function rolesFor(slug: string): Promise<Role[] | null> {
  const cached = store.get(slug);
  if (cached) return cached;
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const roles = slug === "acme-air" ? acmeRoles() : genericRoles(tenant.observedGeneration || tenant.generation, tenant.desired.userCount);
  store.set(slug, roles);
  return roles;
}

export async function listRoles(slug: string): Promise<RolesResponse | null> {
  const [roles, tenant] = await Promise.all([rolesFor(slug), getTenant(slug)]);
  if (!roles || !tenant) return null;
  return RolesResponseSchema.parse({ slug, items: roles, specGeneration: tenant.generation });
}

/**
 * Remove a role from the desired spec. Refuses with 409 while any relation
 * tuple still binds to the role; otherwise stages the removal into the next
 * generation and returns 202.
 */
export async function deleteRole(slug: string, key: string, now: Date): Promise<Result<RoleDeleteResult>> {
  const [roles, tenant] = await Promise.all([rolesFor(slug), getTenant(slug)]);
  if (!roles || !tenant) return { ok: false, status: 404, title: "Tenant not found" };
  const role = roles.find((r) => r.key === key);
  if (!role) return { ok: false, status: 404, title: "Role not found", detail: `${key} is not defined in the spec for ${slug}.` };
  if (role.boundTuples > 0) {
    return {
      ok: false,
      status: 409,
      title: "Role is bound to tuples",
      detail: `${key} is bound to ${role.boundTuples} tuple${role.boundTuples === 1 ? "" : "s"}. Remove those relations before deleting the role.`,
    };
  }
  store.set(
    slug,
    roles.filter((r) => r.key !== key),
  );
  return {
    ok: true,
    data: RoleDeleteResultSchema.parse({ key, generation: tenant.generation + 1, stagedAt: now.toISOString() }),
  };
}

/** Test hook: forget staged deletions. */
export function resetRolesStore(): void {
  store.clear();
}
