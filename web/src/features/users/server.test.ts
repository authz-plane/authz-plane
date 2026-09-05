import { beforeEach, describe, expect, it } from "vitest";
import { acmeUsers, initialsFor } from "./fixtures";
import { parseUsersFilter, UsersPageSchema } from "./schemas";
import { inviteUser, listUsers, refreshUsers, resetUsersStore } from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("users server", () => {
  beforeEach(() => resetUsersStore());

  it("returns page one of acme-air's mirror with frame 18's rows and caption facts", async () => {
    const page = await listUsers("acme-air", {}, undefined);
    expect(page).not.toBeNull();
    expect(UsersPageSchema.parse(page)).toEqual(page);
    expect(page!.items).toHaveLength(8);
    expect(page!.nextCursor).toBe("c8");
    expect(page!.total).toBe(312);
    expect(page!.userCount).toBe(312);
    expect(page!.lastRefreshRunId).toBe("71a0c3d9e5f2");
    expect(page!.lastRefreshedAt).toBe("2026-09-04T10:12:00.000Z");
    expect(page!.asOf).toBe("2026-09-04T10:15:00Z");
    expect(page!.stagedGeneration).toBe(10);
    expect(page!.inviteRoles).toEqual(["tenant_admin", "tenant_editor", "tenant_viewer", "tenant_auditor"]);

    const [ana, mira, dana, ext] = page!.items;
    expect(ana).toMatchObject({ subject: "user:ana", email: "ana.ruiz@acme-air.test", tupleCount: 6, state: "active" });
    expect(mira!.roles).toEqual([{ name: "tenant_auditor", state: "staged" }]);
    expect(dana).toMatchObject({ pendingDeletes: 1, tupleCount: 1 });
    expect(ext).toMatchObject({ subject: "user:ext-audit", name: null, email: "ext-audit@vendor.test", state: "unmanaged" });
    expect(ext!.roles).toEqual([{ name: "admin", state: "drift" }]);
  });

  it("follows the cursor to the last page and then stops", async () => {
    const two = await listUsers("acme-air", {}, "c8");
    expect(two!.items).toHaveLength(8);
    expect(two!.nextCursor).toBeNull();
    const one = await listUsers("acme-air", {}, undefined);
    const ids = new Set([...one!.items, ...two!.items].map((u) => u.id));
    expect(ids.size).toBe(16);
    expect(acmeUsers("2026-09-04T10:15:00Z")).toHaveLength(16);
  });

  it("searches email, subject and name server-side and reports matching totals", async () => {
    const byEmail = await listUsers("acme-air", { q: "vendor.test" }, undefined);
    expect(byEmail!.items.map((u) => u.subject)).toEqual(["user:ext-audit"]);
    expect(byEmail!.total).toBe(1);
    expect(byEmail!.nextCursor).toBeNull();

    const bySubject = await listUsers("acme-air", { q: "user:mi" }, undefined);
    expect(bySubject!.items.map((u) => u.subject)).toEqual(["user:mira"]);

    const byName = await listUsers("acme-air", { q: "LOPEZ" }, undefined);
    expect(byName!.items[0]!.email).toBe("dana.lopez@acme-air.test");

    const none = await listUsers("acme-air", { q: "nobody-here" }, undefined);
    expect(none!.items).toEqual([]);
    expect(none!.total).toBe(0);
  });

  it("normalises the filter from search params", () => {
    expect(parseUsersFilter({ q: "  ana " })).toEqual({ q: "ana" });
    expect(parseUsersFilter({ q: "" })).toEqual({});
    expect(parseUsersFilter({ q: ["a", "b"] })).toEqual({});
    expect(parseUsersFilter({})).toEqual({});
  });

  it("derives smaller mirrors for other tenants and 404s unknown ones", async () => {
    const nw = await listUsers("northwind-rail", {}, undefined);
    expect(nw!.userCount).toBe(41);
    expect(nw!.items.length).toBeGreaterThan(0);
    expect(nw!.items.every((u) => u.email.endsWith("@northwind-rail.test"))).toBe(true);
    expect(nw!.lastRefreshRunId).toMatch(/^[0-9a-f]{12}$/);
    expect(await listUsers("no-such-tenant", {}, undefined)).toBeNull();
  });

  it("refresh answers with the resync run and stamps the mirror", async () => {
    const r = await refreshUsers("acme-air", NOW);
    expect(r).toEqual({ ok: true, data: { runId: "71a0c3d9e5f2", enqueuedAt: "2026-09-04T10:15:00.000Z" } });
    const page = await listUsers("acme-air", {}, undefined);
    expect(page!.lastRefreshedAt).toBe("2026-09-04T10:15:00.000Z");
    expect(await refreshUsers("nope", NOW)).toMatchObject({ ok: false, status: 404 });
  });

  it("invites against spec roles, refusing unknown roles and duplicates", async () => {
    const ok = await inviteUser("acme-air", { email: "New.Person@acme-air.test", role: "tenant_auditor" }, NOW);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.email).toBe("new.person@acme-air.test");
      expect(ok.data.inviteId).toMatch(/^inv_[0-9a-f]{12}$/);
      expect(ok.data.expiresAt).toBe("2026-09-11T10:15:00.000Z");
    }
    expect(await inviteUser("acme-air", { email: "new.person@acme-air.test", role: "tenant_viewer" }, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await inviteUser("acme-air", { email: "ana.ruiz@acme-air.test", role: "tenant_viewer" }, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await inviteUser("acme-air", { email: "x@acme-air.test", role: "superuser" }, NOW)).toMatchObject({ ok: false, status: 422, title: "Unknown role" });
  });

  it("builds avatar initials from the name or the address", () => {
    expect(initialsFor({ name: "Ana Ruiz", email: "ana.ruiz@acme-air.test" })).toBe("AR");
    expect(initialsFor({ name: null, email: "ext-audit@vendor.test" })).toBe("EA");
    expect(initialsFor({ name: null, email: "ops@vendor.test" })).toBe("OP");
  });
});
