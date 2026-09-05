import { afterEach, describe, expect, it } from "vitest";
import { TENANTS } from "./fixtures";
import { TenantSummarySchema, type CreateTenantInput } from "./schemas";
import {
  createTenant,
  getTenant,
  isSlugAvailable,
  listTenants,
  resetCreatedTenantsForTests,
  SlugTakenError,
} from "./server";

afterEach(() => resetCreatedTenantsForTests());

describe("tenant fixtures", () => {
  it("every fixture satisfies the wire schema", () => {
    for (const t of TENANTS) expect(() => TenantSummarySchema.parse(t)).not.toThrow();
  });

  it("slugs are unique", () => {
    expect(new Set(TENANTS.map((t) => t.slug)).size).toBe(TENANTS.length);
  });
});

describe("listTenants", () => {
  it("returns the fleet total when unfiltered", async () => {
    const page = await listTenants({ limit: 25 });
    expect(page.total).toBe(42);
    expect(page.items.length).toBe(TENANTS.length);
    expect(page.nextCursor).toBeNull();
  });

  it("reports the pill counts frame 03 shows", async () => {
    const { counts } = await listTenants({ limit: 25 });
    expect(counts.all).toBe(42);
    expect(counts.byPhase.Ready).toBe(38);
    expect(counts.byPhase.Applying).toBe(1);
    expect(counts.byPhase.Degraded).toBe(2);
    expect(counts.byPhase.Failed).toBe(1);
  });

  it("filters by phase and reports the filtered total", async () => {
    const page = await listTenants({ phase: "Failed", limit: 25 });
    expect(page.items.map((t) => t.slug)).toEqual(["northwind-rail"]);
    expect(page.total).toBe(1);
  });

  it("filters on open drift and searches slug, name and org id", async () => {
    expect((await listTenants({ hasDrift: true, limit: 25 })).items.map((t) => t.slug)).toEqual([
      "acme-air",
      "globex-logistics",
      "umbrella-health",
    ]);
    expect((await listTenants({ q: "214785", limit: 25 })).items[0]?.slug).toBe("acme-air");
    expect((await listTenants({ q: "Globex", limit: 25 })).items[0]?.slug).toBe("globex-logistics");
  });

  it("pages by cursor without overlap and ends with a null cursor", async () => {
    const first = await listTenants({ limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.nextCursor).toBe(first.items[2]?.slug);

    const second = await listTenants({ limit: 3, cursor: first.nextCursor ?? undefined });
    expect(second.items.map((t) => t.slug)).toEqual(TENANTS.slice(3, 6).map((t) => t.slug));

    const third = await listTenants({ limit: 3, cursor: second.nextCursor ?? undefined });
    expect(third.items.map((t) => t.slug)).toEqual([TENANTS[6]?.slug]);
    expect(third.nextCursor).toBeNull();
  });

  it("treats an unknown cursor as the first page", async () => {
    const page = await listTenants({ limit: 3, cursor: "does-not-exist" });
    expect(page.items[0]?.slug).toBe(TENANTS[0]?.slug);
  });
});

describe("getTenant", () => {
  it("returns the degraded detail for acme-air", async () => {
    const t = await getTenant("acme-air");
    expect(t?.phase).toBe("Degraded");
    expect(t?.generation).toBe(9);
    expect(t?.observedGeneration).toBe(8);
    expect(t?.lastError?.attempt).toBe(3);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getTenant("nope")).toBeNull();
  });
});

const INPUT: CreateTenantInput = {
  displayName: "Vertex Freight",
  slug: "vertex-freight",
  startFrom: "blank",
  starterModel: "roles-only",
  autoHeal: false,
  resyncIntervalSeconds: 600,
};
const NOW = new Date("2026-09-04T10:15:00Z");

describe("createTenant", () => {
  it("writes generation 1 as Pending with nothing reconciled yet", async () => {
    const created = await createTenant(INPUT, NOW);
    expect(created).toMatchObject({
      slug: "vertex-freight",
      displayName: "Vertex Freight",
      phase: "Pending",
      generation: 1,
      observedGeneration: 0,
      openDrift: 0,
      lastReconciledAt: null,
      orgId: null,
      autoHeal: false,
      resyncIntervalSeconds: 600,
      createdAt: "2026-09-04T10:15:00.000Z",
    });
    expect(created.id).toMatch(/^[0-9a-f]{6}$/);
    expect(created.specHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it("shows up first in the list, bumps the counts, and resolves as a detail", async () => {
    await createTenant(INPUT, NOW);
    const page = await listTenants({ limit: 25 });
    expect(page.items[0]?.slug).toBe("vertex-freight");
    expect(page.total).toBe(43);
    expect(page.counts.all).toBe(43);
    expect(page.counts.byPhase.Pending).toBe(1);

    const detail = await getTenant("vertex-freight");
    expect(detail?.desired.roles).toEqual(["tenant_admin", "tenant_viewer"]);
    expect(detail?.desired.policy).toBe("auto-heal off · resync 600s");
    expect(detail?.modelVersion).toBe(0);
  });

  it("rejects a duplicate slug with SlugTakenError (409)", async () => {
    await createTenant(INPUT, NOW);
    const again = createTenant({ ...INPUT, displayName: "Vertex Freight 2" }, NOW);
    await expect(again).rejects.toBeInstanceOf(SlugTakenError);
    await expect(again).rejects.toMatchObject({ status: 409, title: "Slug already taken" });
    await expect(createTenant({ ...INPUT, slug: "acme-air" }, NOW)).rejects.toBeInstanceOf(SlugTakenError);
  });

  it("validates the body against the schema", async () => {
    await expect(createTenant({ ...INPUT, slug: "new" }, NOW)).rejects.toThrow();
    await expect(createTenant({ ...INPUT, displayName: "   " }, NOW)).rejects.toThrow();
  });
});

describe("isSlugAvailable", () => {
  it("is taken for fixtures and console-created tenants, reserved for route words, free otherwise", async () => {
    expect(await isSlugAvailable("acme-air")).toEqual({ available: false, reason: "taken" });
    expect(await isSlugAvailable("new")).toEqual({ available: false, reason: "reserved" });
    expect(await isSlugAvailable("Bad Slug")).toMatchObject({ available: false });
    expect(await isSlugAvailable("vertex-freight")).toEqual({ available: true });
    await createTenant(INPUT, NOW);
    expect(await isSlugAvailable("vertex-freight")).toEqual({ available: false, reason: "taken" });
  });
});
