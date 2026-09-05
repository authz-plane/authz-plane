import { describe, expect, it } from "vitest";
import { DEFAULT_QUERY } from "./fixtures";
import { PlaygroundTenantSchema } from "./schemas";
import { batchCheckForTenant, explainForTenant, listPlaygroundTenants } from "./server";

describe("playground server", () => {
  it("lists every canonical tenant with model version and relations", async () => {
    const tenants = await listPlaygroundTenants();
    expect(tenants.map((t) => t.slug)).toContain("acme-air");
    expect(tenants.map((t) => t.slug)).toContain("northwind-rail");
    const acme = tenants.find((t) => t.slug === "acme-air")!;
    expect(PlaygroundTenantSchema.parse(acme)).toEqual(acme);
    expect(acme.modelVersion).toBe(6);
    expect(acme.relations).toContain("viewer");
  });

  it("explains against the tenant's model at the fixture instant", async () => {
    const r = await explainForTenant("acme-air", { ...DEFAULT_QUERY, includeProvenance: true }, "strong");
    expect(r?.allowed).toBe(true);
    expect(r?.modelVersion).toBe(6);
    expect(r?.checkedAt).toBe("2026-09-04T10:15:00Z");
    expect(r?.decisive?.auditEventId).toBe("evt_tuple_a3f1");
  });

  it("returns null for an unknown tenant so the route can answer 404", async () => {
    expect(await explainForTenant("no-such-tenant", { ...DEFAULT_QUERY, includeProvenance: true }, "strong")).toBeNull();
    expect(await batchCheckForTenant("no-such-tenant", { checks: [DEFAULT_QUERY] }, "strong")).toBeNull();
  });

  it("batch-checks with the requested consistency", async () => {
    const r = await batchCheckForTenant("acme-air", { checks: [DEFAULT_QUERY, { ...DEFAULT_QUERY, user: "user:nobody" }] }, "eventual");
    expect(r?.results.map((x) => x.allowed)).toEqual([true, false]);
    expect(r?.consistency).toBe("eventual");
  });
});
