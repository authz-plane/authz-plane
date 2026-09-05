import { describe, expect, it } from "vitest";
import { dashboardFixture, shellFixture } from "./fixtures";
import { DashboardOverviewSchema, ShellSummarySchema } from "./schemas";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("dashboard fixtures", () => {
  it("satisfy the wire schemas for every window", () => {
    for (const w of ["1h", "6h", "24h", "7d"] as const) {
      expect(() => DashboardOverviewSchema.parse(dashboardFixture(w, NOW))).not.toThrow();
    }
    expect(() => ShellSummarySchema.parse(shellFixture())).not.toThrow();
  });

  it("are deterministic for a fixed now", () => {
    expect(dashboardFixture("24h", NOW)).toEqual(dashboardFixture("24h", NOW));
  });

  it("produce twelve chronologically ordered buckets spanning the window", () => {
    const { buckets } = dashboardFixture("6h", NOW).outcomes;
    expect(buckets).toHaveLength(12);
    const times = buckets.map((b) => Date.parse(b.startsAt));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    expect(NOW.getTime() - times[0]!).toBe(6 * 60 * 60 * 1000);
  });

  it("derive run totals and success rate from the buckets", () => {
    const { outcomes } = dashboardFixture("24h", NOW);
    const runs = outcomes.buckets.reduce((n, b) => n + b.ready + b.degraded + b.failed, 0);
    const bad = outcomes.buckets.reduce((n, b) => n + b.degraded + b.failed, 0);
    expect(outcomes.runs).toBe(runs);
    expect(outcomes.successRate).toBeCloseTo((runs - bad) / runs, 6);
  });

  it("agree with the canonical tenant story", () => {
    const d = dashboardFixture("24h", NOW);
    expect(d.tenants.total).toBe(42);
    expect(d.tenants.converged).toBe(38);
    expect(d.drift).toEqual({ open: 7, tenantsAffected: 3 });
    expect(d.needsAttention.map((i) => i.slug)).toEqual([
      "northwind-rail",
      "acme-air",
      "globex-logistics",
      "initech-labs",
    ]);
  });
});
