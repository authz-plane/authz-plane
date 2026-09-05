import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_NOW, TENANTS } from "@/features/tenants/fixtures";
import { driftFixtures } from "./fixtures";
import { durationShort, relativeAge, rowActionFor, utcTimeOfDay } from "./format";
import { DriftFindingSchema, DriftListSchema, driftFilterFromSearch, HealRequestSchema } from "./schemas";
import { acknowledgeFinding, getDriftFinding, healFindings, listDrift, resetDriftStore, resyncAll } from "./server";

const NOW = new Date(FIXTURE_NOW);

beforeEach(() => resetDriftStore(NOW));

describe("drift fixtures", () => {
  const findings = driftFixtures(NOW);

  it("every finding satisfies the schema and belongs to a canonical tenant", () => {
    const slugs = new Set(TENANTS.map((t) => t.slug));
    for (const f of findings) {
      expect(() => DriftFindingSchema.parse(f)).not.toThrow();
      expect(slugs.has(f.tenant), f.tenant).toBe(true);
    }
    expect(new Set(findings.map((f) => f.id)).size).toBe(findings.length);
  });

  it("tells the story the frames and the tenant fixtures agree on: 7 open across 3 tenants", () => {
    const byTenant = new Map<string, number>();
    for (const f of findings) byTenant.set(f.tenant, (byTenant.get(f.tenant) ?? 0) + 1);
    expect(byTenant.get("acme-air")).toBe(2);
    expect(byTenant.get("globex-logistics")).toBe(4);
    expect(byTenant.get("umbrella-health")).toBe(1);
    expect(findings).toHaveLength(7);
    // The tenants fixture only materialises drift counts for these two; umbrella-health's low finding is drift-only.
    for (const slug of ["acme-air", "globex-logistics"]) {
      expect(TENANTS.find((t) => t.slug === slug)?.openDrift).toBe(byTenant.get(slug));
    }
  });

  it("carries the globex claimMappings.email finding exactly as frame 11 shows it", () => {
    const f = findings.find((x) => x.id === "9c1f7e2a")!;
    expect(f).toMatchObject({
      tenant: "globex-logistics",
      title: "claimMappings.email changed out-of-band",
      desired: '"email"',
      actual: '"upn"',
      severity: "high",
      detectedByRun: "a7d3",
      autoHeal: false,
    });
    expect(utcTimeOfDay(f.detectedAt)).toBe("10:08:41Z");
    expect(f.evidence).toMatchObject({ actualStateHash: "2f08…9c", lastKnownHash: "8b41…07", siblingFindings: 4 });
    expect(f.healPlan).toEqual({ resource: "zitadel.idp", description: 'set claimMappings.email = "email"', changeKey: "7b02…14" });
  });

  it("acme-air findings point at the degraded run the run detail screen shows", () => {
    for (const f of findings.filter((x) => x.tenant === "acme-air")) {
      expect(f.reconcileRunId).toBe("8f1c9e4b27d2");
      expect(f.autoHeal).toBe(true);
    }
  });
});

describe("format helpers", () => {
  it("row action: low → ack, autoHeal with a run → view reconcile, otherwise heal", () => {
    expect(rowActionFor({ severity: "low", autoHeal: false, reconcileRunId: null })).toBe("ack");
    expect(rowActionFor({ severity: "medium", autoHeal: true, reconcileRunId: "8f1c" })).toBe("view-reconcile");
    expect(rowActionFor({ severity: "medium", autoHeal: true, reconcileRunId: null })).toBe("heal");
    expect(rowActionFor({ severity: "high", autoHeal: false, reconcileRunId: null })).toBe("heal");
  });

  it("formats ages and durations the way frame 10 reads", () => {
    expect(durationShort(4 * 3600 + 12 * 60)).toBe("4h 12m");
    expect(durationShort(22 * 60)).toBe("22m");
    expect(durationShort(3600)).toBe("1h");
    expect(durationShort(26 * 3600)).toBe("1d 2h");
    expect(relativeAge("2026-09-04T10:09:00Z", FIXTURE_NOW)).toBe("6m ago");
    expect(relativeAge("2026-09-04T10:14:50Z", FIXTURE_NOW)).toBe("just now");
  });
});

describe("driftFilterFromSearch", () => {
  it("accepts tenant and a known severity from a record or URLSearchParams and drops junk", () => {
    expect(driftFilterFromSearch({ tenant: "acme-air", severity: "high" })).toEqual({ tenant: "acme-air", severity: "high" });
    expect(driftFilterFromSearch(new URLSearchParams("severity=critical&tenant="))).toEqual({});
    expect(driftFilterFromSearch({ severity: ["high", "low"] })).toEqual({});
  });
});

describe("listDrift", () => {
  it("returns the platform stats from frame 10 and sorts high severity first", async () => {
    const page = await listDrift({}, NOW);
    expect(() => DriftListSchema.parse(page)).not.toThrow();
    expect(page.stats).toEqual({ open: 7, tenantsAffected: 3, oldestUnresolvedSeconds: 4 * 3600 + 12 * 60, healedToday: 19 });
    expect(page.items.map((f) => f.severity)).toEqual(["high", "high", "medium", "medium", "medium", "medium", "low"]);
    expect(page.items[0]?.id).toBe("9c1f7e2a");
    expect(page.tenants).toEqual(["acme-air", "globex-logistics", "umbrella-health"]);
    expect(page.resyncIntervalSeconds).toBe(600);
    expect(relativeAge(page.lastResyncAt, page.generatedAt)).toBe("4m ago");
  });

  it("filters by tenant, scoping the stats to that tenant", async () => {
    const page = await listDrift({ tenant: "globex-logistics" }, NOW);
    expect(page.items).toHaveLength(4);
    expect(page.items.every((f) => f.tenant === "globex-logistics")).toBe(true);
    expect(page.stats.open).toBe(4);
    expect(page.stats.tenantsAffected).toBe(1);
    // The tenant select still lists every tenant with open drift.
    expect(page.tenants).toHaveLength(3);
  });

  it("filters by severity without changing the scope stats", async () => {
    const page = await listDrift({ severity: "high" }, NOW);
    expect(page.items.map((f) => f.id).sort()).toEqual(["9c1f7e2a", "e4b2a9d1"]);
    expect(page.stats.open).toBe(7);
  });

  it("an unknown tenant yields an empty list with null oldest", async () => {
    const page = await listDrift({ tenant: "nobody" }, NOW);
    expect(page.items).toEqual([]);
    expect(page.stats).toMatchObject({ open: 0, tenantsAffected: 0, oldestUnresolvedSeconds: null });
  });
});

describe("healFindings", () => {
  it("validates the request shape", () => {
    expect(HealRequestSchema.safeParse({ findingIds: [] }).success).toBe(false);
    expect(HealRequestSchema.safeParse({ findingIds: ["9c1f7e2a"] }).success).toBe(true);
  });

  it("removes the findings, returns one run per affected tenant and bumps healed today", async () => {
    const res = await healFindings(["9c1f7e2a", "e4b2a9d1", "3a6f2d91", "does-not-exist"]);
    expect(res.runs.map((r) => r.tenant).sort()).toEqual(["acme-air", "globex-logistics"]);
    expect(new Set(res.runs.map((r) => r.runId)).size).toBe(2);
    for (const r of res.runs) expect(r.runId).toMatch(/^[0-9a-f]{12}$/);

    const page = await listDrift({}, NOW);
    expect(page.items.map((f) => f.id)).not.toContain("9c1f7e2a");
    expect(page.stats).toMatchObject({ open: 4, tenantsAffected: 3, healedToday: 22 });
    expect(await getDriftFinding("9c1f7e2a")).toBeNull();
  });

  it("healing nothing that is open returns no runs", async () => {
    await healFindings(["9c1f7e2a"]);
    expect((await healFindings(["9c1f7e2a"])).runs).toEqual([]);
  });
});

describe("acknowledgeFinding", () => {
  it("marks the finding acknowledged, drops it from the open list, and keeps it addressable", async () => {
    const ack = await acknowledgeFinding("f20d4a6b");
    expect(ack?.status).toBe("acknowledged");
    const page = await listDrift({}, NOW);
    expect(page.items.map((f) => f.id)).not.toContain("f20d4a6b");
    expect(page.stats.open).toBe(6);
    expect(page.stats.healedToday).toBe(19);
    expect((await getDriftFinding("f20d4a6b"))?.status).toBe("acknowledged");
    expect(await acknowledgeFinding("nope")).toBeNull();
  });
});

describe("resyncAll", () => {
  it("answers accepted and moves lastResyncAt to now", async () => {
    const later = new Date(NOW.getTime() + 60_000);
    const res = await resyncAll(later);
    expect(res).toEqual({ status: "accepted", scheduledAt: later.toISOString() });
    expect((await listDrift({}, later)).lastResyncAt).toBe(later.toISOString());
  });
});
