import type { Role } from "./schemas";

/**
 * acme-air roles (frame 13 + tenant fixture desired.roles): four spec roles,
 * tenant_auditor staged in generation 10 and not yet applied, plus one unused
 * legacy role. Bound-tuple counts are what the delete guard reports.
 */
export function acmeRoles(): Role[] {
  return [
    {
      key: "tenant_admin",
      users: 14,
      permissions: ["tenant.read", "tenant.write", "relations.write", "audit.read", "idp.manage"],
      boundTuples: 14,
      source: { kind: "spec", generation: 6 },
      staged: false,
      unusedDays: null,
    },
    {
      key: "tenant_editor",
      users: 38,
      permissions: ["tenant.read", "tenant.write", "relations.write"],
      boundTuples: 38,
      source: { kind: "spec", generation: 6 },
      staged: false,
      unusedDays: null,
    },
    {
      key: "tenant_viewer",
      users: 286,
      permissions: ["tenant.read", "audit.read"],
      boundTuples: 286,
      source: { kind: "spec", generation: 6 },
      staged: false,
      unusedDays: null,
    },
    {
      key: "tenant_auditor",
      users: 0,
      permissions: ["tenant.read", "audit.read"],
      boundTuples: 0,
      source: { kind: "spec", generation: 10 },
      staged: true,
      unusedDays: null,
    },
    {
      key: "tenant_legacy_ops",
      users: 0,
      permissions: ["tenant.read"],
      boundTuples: 0,
      source: { kind: "spec", generation: 3 },
      staged: false,
      unusedDays: 41,
    },
  ];
}

/** Every other tenant: the two roles the tenant fixture's desired state lists. */
export function genericRoles(generation: number, users: number): Role[] {
  const admins = Math.max(1, Math.round(users * 0.1));
  return [
    {
      key: "tenant_admin",
      users: admins,
      permissions: ["tenant.read", "tenant.write", "relations.write", "audit.read", "idp.manage"],
      boundTuples: admins,
      source: { kind: "spec", generation },
      staged: false,
      unusedDays: null,
    },
    {
      key: "tenant_viewer",
      users: users - admins,
      permissions: ["tenant.read", "audit.read"],
      boundTuples: users - admins,
      source: { kind: "spec", generation },
      staged: false,
      unusedDays: null,
    },
  ];
}
