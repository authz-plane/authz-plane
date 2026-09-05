import { beforeEach, describe, expect, it } from "vitest";
import { TENANTS } from "@/features/tenants/fixtures";
import { FIXTURE_NOW, LIVE_SCRIPTS, RUN_IDS, reconcileRunFixtures } from "./fixtures";
import { RunDetailSchema, RunPageSchema, RunSummarySchema } from "./schemas";
import { getRun, listRuns, resetReconcileStoreForTests, retryRun } from "./server";

const NOW = new Date(FIXTURE_NOW);
const ALL = { limit: 25 };

beforeEach(() => resetReconcileStoreForTests());

describe("reconcile fixtures", () => {
  const runs = reconcileRunFixtures(NOW);

  it("every fixture satisfies the detail and summary schemas", () => {
    for (const r of runs) {
      expect(() => RunDetailSchema.parse(r)).not.toThrow();
      expect(() => RunSummarySchema.parse(r)).not.toThrow();
    }
  });

  it("ids are unique and every run belongs to a canonical tenant", () => {
    expect(new Set(runs.map((r) => r.id)).size).toBe(runs.length);
    const slugs = new Set(TENANTS.map((t) => t.slug));
    for (const r of runs) expect(slugs.has(r.tenantSlug), r.tenantSlug).toBe(true);
  });

  it("carries the runs other screens link to, with the story the frames tell", () => {
    const acme = runs.find((r) => r.id === RUN_IDS.acmePartial)!;
    expect(acme).toMatchObject({ tenantSlug: "acme-air", generation: 9, trigger: "outbox", outcome: "Partial", durationMs: 3400 });
    expect(acme.startedAt).toBe("2026-09-04T10:14:22.000Z");
    expect(acme.traceId.startsWith("4bf9") && acme.traceId.endsWith("a1")).toBe(true);
    expect(acme.changes.map((c) => c.outcome)).toEqual(["applied", "applied", "applied", "failed", "skipped"]);
    expect(acme.changes[3]?.error).toMatchObject({ attempt: 3, maxAttempts: 8, nextRetrySeconds: 45 });
    expect(acme.log.at(-2)?.text).toBe("phase Degraded, retry at 10:15:12");
    expect(acme.log.at(-1)?.text).toBe("lock released, msg requeued");

    const northwind = runs.find((r) => r.id === RUN_IDS.northwindExhausted)!;
    expect(northwind).toMatchObject({ tenantSlug: "northwind-rail", generation: 4, trigger: "backoff", outcome: "Failed", attempt: { n: 8, max: 8 } });

    const users = runs.find((r) => r.id === RUN_IDS.acmeUsersResync)!;
    expect(users).toMatchObject({ tenantSlug: "acme-air", trigger: "resync", outcome: "NoChanges", changeOutcomes: [] });

    const live = runs.find((r) => r.id === RUN_IDS.initechLive)!;
    expect(live).toMatchObject({ tenantSlug: "initech-labs", generation: 7, outcome: "Applying", finishedAt: null });
  });

  it("in-flight runs have no finishedAt and settled runs do", () => {
    for (const r of runs) {
      const inFlight = r.outcome === "Applying" || r.outcome === "Deleting";
      expect(r.finishedAt === null, r.id).toBe(inFlight);
    }
  });
});

describe("listRuns", () => {
  it("returns the platform headline stats and every run newest-first when unfiltered", async () => {
    const page = await listRuns(ALL);
    expect(() => RunPageSchema.parse(page)).not.toThrow();
    expect(page.total).toBe(318);
    expect(page.stats).toEqual({ runs: 318, medianDurationMs: 1900, noChangeRatio: 0.71, retriesInBackoff: 3 });
    expect(page.items.length).toBe(14);
    expect(page.nextCursor).toBeNull();
    const times = page.items.map((r) => Date.parse(r.startedAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(page.window).toBe("last 6h");
  });

  it("filters by trigger", async () => {
    const page = await listRuns({ ...ALL, trigger: "backoff" });
    expect(page.items.map((r) => r.tenantSlug)).toEqual(["northwind-rail", "northwind-rail"]);
    expect(page.total).toBe(2);
  });

  it("filters by outcome", async () => {
    const page = await listRuns({ ...ALL, outcome: "Drift" });
    expect(page.items.map((r) => r.id)).toEqual([RUN_IDS.globexDrift]);
    expect(page.items[0]?.driftCount).toBe(4);
  });

  it("filters by tenant and reports the tenant's own totals", async () => {
    const page = await listRuns({ ...ALL, tenant: "acme-air" });
    expect(page.items.every((r) => r.tenantSlug === "acme-air")).toBe(true);
    expect(page.items.map((r) => r.id)).toEqual([RUN_IDS.acmePartial, RUN_IDS.acmeUsersResync, "b9e24f7a0c15"]);
    expect(page.total).toBe(31);
    expect(page.stats.runs).toBe(31);
  });

  it("combines filters and derives stats from the narrowed set", async () => {
    const page = await listRuns({ ...ALL, tenant: "acme-air", outcome: "NoChanges" });
    expect(page.items.map((r) => r.id)).toEqual([RUN_IDS.acmeUsersResync]);
    expect(page.stats).toMatchObject({ runs: 1, noChangeRatio: 1, medianDurationMs: 600 });
  });

  it("paginates with a cursor", async () => {
    const first = await listRuns({ limit: 5 });
    expect(first.items.length).toBe(5);
    expect(first.nextCursor).toBe(first.items[4]?.id);
    const second = await listRuns({ limit: 5, cursor: first.nextCursor! });
    expect(second.items[0]?.id).not.toBe(first.items[0]?.id);
    expect(second.items.some((r) => first.items.map((f) => f.id).includes(r.id))).toBe(false);
    const third = await listRuns({ limit: 5, cursor: second.nextCursor! });
    expect(third.items.length).toBe(4);
    expect(third.nextCursor).toBeNull();
  });
});

describe("getRun", () => {
  it("returns null for an unknown id", async () => {
    expect(await getRun("000000000000")).toBeNull();
  });

  it("returns the settled acme-air run unchanged across calls", async () => {
    const a = await getRun(RUN_IDS.acmePartial);
    const b = await getRun(RUN_IDS.acmePartial);
    expect(a).toEqual(b);
    expect(a?.finishedAt).not.toBeNull();
  });

  it("advances the live initech run one log line per poll until it settles", async () => {
    const script = LIVE_SCRIPTS[RUN_IDS.initechLive]!;
    const first = await getRun(RUN_IDS.initechLive);
    const baseline = first!.log.length;
    expect(first?.finishedAt).toBeNull();
    expect(first?.log.at(-1)?.text).toBe(script[0]!.log.text);
    expect(first?.changes[3]?.outcome).toBe("applied");
    expect(first?.changes[4]?.outcome).toBe("applying");

    const second = await getRun(RUN_IDS.initechLive);
    expect(second?.log.length).toBe(baseline + 1);
    expect(second?.changes[4]?.outcome).toBe("applied");

    let last = second;
    for (let i = 2; i < script.length; i++) last = await getRun(RUN_IDS.initechLive);
    expect(last?.finishedAt).not.toBeNull();
    expect(last?.outcome).toBe("Applied");
    expect(last?.changeOutcomes.every((o) => o === "applied")).toBe(true);
    expect(last?.facts.advisoryLockHeldMs).toBe(last?.durationMs);

    // Settled: further polls change nothing.
    const again = await getRun(RUN_IDS.initechLive);
    expect(again).toEqual(last);
  });

  it("appears in the list with the same state the detail reached", async () => {
    await getRun(RUN_IDS.initechLive);
    const page = await listRuns(ALL);
    const row = page.items.find((r) => r.id === RUN_IDS.initechLive);
    expect(row?.changeOutcomes).toEqual(["applied", "applied", "applied", "applied", "applying"]);
  });
});

describe("retryRun", () => {
  it("creates a new Applying run that references the original", async () => {
    const result = await retryRun(RUN_IDS.acmePartial, "key-1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.runId).not.toBe(RUN_IDS.acmePartial);
    expect(result.runId).toMatch(/^[0-9a-f]{12}$/);

    const run = await getRun(result.runId);
    expect(run).toMatchObject({ tenantSlug: "acme-air", generation: 9, trigger: "manual", retryOf: RUN_IDS.acmePartial, attempt: null });
    expect(run?.changes.length).toBe(5);
    expect(run?.changes.every((c) => c.error === undefined)).toBe(true);

    const page = await listRuns({ ...ALL, tenant: "acme-air" });
    expect(page.items[0]?.id).toBe(result.runId);
  });

  it("replays the same Idempotency-Key to the same run", async () => {
    const a = await retryRun(RUN_IDS.acmePartial, "key-2");
    const b = await retryRun(RUN_IDS.acmePartial, "key-2");
    expect(a).toEqual(b);
    const c = await retryRun(RUN_IDS.acmePartial, "key-3");
    expect(c.ok && a.ok && c.runId !== a.runId).toBe(true);
  });

  it("settles Applied after one poll per change", async () => {
    const result = await retryRun(RUN_IDS.acmePartial, "key-4");
    if (!result.ok) throw new Error("expected ok");
    let run = await getRun(result.runId);
    let polls = 1;
    while (run?.finishedAt === null && polls < 20) {
      run = await getRun(result.runId);
      polls++;
    }
    expect(run?.outcome).toBe("Applied");
    expect(run?.changeOutcomes).toEqual(["applied", "applied", "applied", "applied", "applied"]);
    expect(polls).toBe(1 + 5 + 1);
  });

  it("refuses to retry an in-flight run and 404s on unknown ids", async () => {
    expect(await retryRun(RUN_IDS.initechLive, "key-5")).toMatchObject({ ok: false, status: 409 });
    expect(await retryRun("000000000000", "key-6")).toMatchObject({ ok: false, status: 404 });
  });
});
