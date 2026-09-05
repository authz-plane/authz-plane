import { beforeEach, describe, expect, it } from "vitest";
import { acmeRoles } from "./fixtures";
import { RoleSchema } from "./schemas";
import { deleteRole, listRoles, resetRolesStore } from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");

beforeEach(() => resetRolesStore());

describe("role fixtures", () => {
  it("satisfy the wire schema and tell the acme-air story", () => {
    const roles = acmeRoles();
    for (const r of roles) expect(() => RoleSchema.parse(r)).not.toThrow();
    expect(roles.map((r) => r.key)).toEqual([
      "tenant_admin",
      "tenant_editor",
      "tenant_viewer",
      "tenant_auditor",
      "tenant_legacy_ops",
    ]);
    expect(roles.find((r) => r.key === "tenant_auditor")).toMatchObject({ staged: true, source: { generation: 10 }, boundTuples: 0 });
    expect(roles.find((r) => r.key === "tenant_legacy_ops")).toMatchObject({ users: 0, unusedDays: 41 });
  });
});

describe("listRoles", () => {
  it("returns five roles at spec generation 9 for acme-air", async () => {
    const r = await listRoles("acme-air");
    expect(r?.items).toHaveLength(5);
    expect(r?.specGeneration).toBe(9);
  });

  it("returns the generic pair for other tenants and null for unknown slugs", async () => {
    expect((await listRoles("globex-logistics"))?.items.map((r) => r.key)).toEqual(["tenant_admin", "tenant_viewer"]);
    expect(await listRoles("nope")).toBeNull();
  });
});

describe("deleteRole", () => {
  it("refuses with a 409 problem while tuples bind to the role, and keeps it", async () => {
    const r = await deleteRole("acme-air", "tenant_admin", NOW);
    expect(r).toEqual({
      ok: false,
      status: 409,
      title: "Role is bound to tuples",
      detail: "tenant_admin is bound to 14 tuples. Remove those relations before deleting the role.",
    });
    expect((await listRoles("acme-air"))?.items.some((x) => x.key === "tenant_admin")).toBe(true);
  });

  it("stages the removal of an unbound role into generation 10 and drops it from the store", async () => {
    const r = await deleteRole("acme-air", "tenant_legacy_ops", NOW);
    expect(r).toEqual({ ok: true, data: { key: "tenant_legacy_ops", generation: 10, stagedAt: NOW.toISOString() } });
    const after = await listRoles("acme-air");
    expect(after?.items.map((x) => x.key)).not.toContain("tenant_legacy_ops");
    expect(after?.items).toHaveLength(4);
  });

  it("404s for an unknown role or tenant", async () => {
    expect(await deleteRole("acme-air", "nope", NOW)).toMatchObject({ ok: false, status: 404, title: "Role not found" });
    expect(await deleteRole("nope", "tenant_admin", NOW)).toMatchObject({ ok: false, status: 404, title: "Tenant not found" });
  });
});
