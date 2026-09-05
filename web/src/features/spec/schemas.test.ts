import { describe, expect, it } from "vitest";
import { acmeSpec, acmeVersions, planFixture } from "./fixtures";
import { fnv1a } from "./hash";
import { PlanSchema, SpecVersionSchema, SpecVersionsSchema, shortHash } from "./schemas";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("spec fixtures against the wire schemas", () => {
  it("acme-air has nine generations, newest first, each parsing as a SpecVersion", () => {
    const versions = acmeVersions();
    expect(versions.map((v) => v.generation)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1]);
    for (const v of versions) expect(() => SpecVersionSchema.parse(v)).not.toThrow();
    expect(versions[0]!.status).toBe("current");
    expect(versions[1]!.status).toBe("applied");
    expect(versions[2]!.status).toBe("superseded");
    expect(versions.find((v) => v.generation === 7)!.author).toBe("ci-bot (m2m)");
    expect(versions[0]!.author).toBe("ops@acme-air.test");
    expect(() =>
      SpecVersionsSchema.parse({ slug: "acme-air", items: versions, total: 9, currentGeneration: 9, observedGeneration: 8 }),
    ).not.toThrow();
  });

  it("the generation-9 body is 62 lines with clientSecretRef on line 15, as frame 05 shows", () => {
    const body = acmeVersions()[0]!.body;
    const lines = body.split("\n");
    expect(lines).toHaveLength(62);
    expect(lines[14]).toBe("      clientSecretRef: acme-entra-secret");
    expect(body).toContain("- key: tenant_auditor");
    expect(body).not.toContain("user:dana");
    expect(fnv1a(body)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("never carries a literal secret, only refs", () => {
    for (const v of acmeVersions()) expect(v.body).not.toMatch(/clientSecret:/);
  });

  it("builds a plan of 4 create / 2 update / 1 delete / 18 unchanged that parses", () => {
    const plan = planFixture("acme-air", "Acme Air", 10, NOW);
    expect(() => PlanSchema.parse(plan)).not.toThrow();
    expect(plan.summary).toEqual({ create: 4, update: 2, delete: 1, unchanged: 18 });
    expect(plan.changes).toHaveLength(7);
    expect(plan.actualReadAt).toBe("2026-09-04T10:14:22.000Z");
    expect(plan.changes.map((c) => c.kind)).toEqual(["zitadel.org", "zitadel.idp", "fga.model", "plane.role", "fga.tuple", "fga.tuple", "fga.tuple"]);
  });

  it("shortHash abbreviates the way every frame does", () => {
    expect(shortHash("3a91e02b5dc7")).toBe("3a91…c7");
    expect(shortHash("b7e21f04")).toBe("b7e2…04");
    expect(shortHash("abc")).toBe("abc");
  });

  it("acmeSpec is deterministic for the same options", () => {
    const opts = {
      secretRef: "x",
      model: 6 as const,
      auditorRole: false,
      editorRole: true,
      legacyOpsRole: false,
      danaTuple: true,
      miraTuple: false,
      groupsClaim: false,
      legacySaml: false,
      resyncIntervalSeconds: 600,
    };
    expect(acmeSpec(opts)).toBe(acmeSpec(opts));
  });
});
