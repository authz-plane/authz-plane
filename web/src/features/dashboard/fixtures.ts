import type {
  DashboardOverview,
  OutcomeBucket,
  ShellSummary,
  Window,
} from "@/features/dashboard/schemas";

/**
 * Fixture data for the platform overview, lifted from frame 02 of the design
 * handoff. Tenant slugs are fictional. Replace with API calls in
 * features/dashboard/server.ts once the .NET API exposes the endpoints.
 */

// Twelve buckets, matching the twelve columns in the reference chart. Heights in
// the mock were 62/78/62/96/70/58/120/88/104/76/130/112 px on a 150px axis; the
// counts below reproduce those proportions.
const BUCKET_COUNTS: ReadonlyArray<[ready: number, degraded: number, failed: number]> =
  [
    [16, 0, 0],
    [20, 0, 0],
    [14, 2, 0],
    [25, 0, 0],
    [18, 0, 0],
    [11, 0, 4],
    [31, 0, 0],
    [23, 0, 0],
    [27, 0, 0],
    [17, 3, 0],
    [34, 0, 0],
    [29, 0, 0],
  ];

function buckets(window: Window, now: Date): OutcomeBucket[] {
  const spanMs = windowMs(window) / BUCKET_COUNTS.length;
  return BUCKET_COUNTS.map(([ready, degraded, failed], i) => ({
    startsAt: new Date(
      now.getTime() - (BUCKET_COUNTS.length - i) * spanMs,
    ).toISOString(),
    ready,
    degraded,
    failed,
  }));
}

function windowMs(window: Window): number {
  switch (window) {
    case "1h":
      return 60 * 60 * 1000;
    case "6h":
      return 6 * 60 * 60 * 1000;
    case "24h":
      return 24 * 60 * 60 * 1000;
    case "7d":
      return 7 * 24 * 60 * 60 * 1000;
  }
}

export function dashboardFixture(window: Window, now: Date): DashboardOverview {
  const series = buckets(window, now);
  const runs = series.reduce((n, b) => n + b.ready + b.degraded + b.failed, 0);
  const failed = series.reduce((n, b) => n + b.failed, 0);
  const degraded = series.reduce((n, b) => n + b.degraded, 0);

  return {
    generatedAt: now.toISOString(),
    window,
    tenants: {
      total: 42,
      converged: 38,
      byPhase: {
        Pending: 0,
        Planning: 0,
        Applying: 1,
        Ready: 38,
        Degraded: 2,
        Failed: 1,
        Deleting: 0,
      },
    },
    convergenceLag: { p95Seconds: 21, sloSeconds: 30 },
    drift: { open: 7, tenantsAffected: 3 },
    outbox: { depth: 4, lagSeconds: 1.2 },
    outcomes: {
      runs,
      successRate: (runs - failed - degraded) / runs,
      buckets: series,
    },
    needsAttention: [
      {
        slug: "northwind-rail",
        kind: "failed",
        label: "Failed",
        reason: "8/8 attempts exhausted · IdP connection create returned 400",
        href: "/tenants/northwind-rail",
      },
      {
        slug: "acme-air",
        kind: "degraded",
        label: "Degraded",
        reason: "retry in 45s · OpenFGA tuple write timed out",
        href: "/tenants/acme-air",
      },
      {
        slug: "globex-logistics",
        kind: "drift",
        label: "Drift ×4",
        reason: "claimMappings.email changed out-of-band 6m ago",
        href: "/drift?tenant=globex-logistics",
      },
      {
        slug: "initech-labs",
        kind: "applying",
        label: "Applying",
        reason: "gen 7 · 3 of 5 changes applied",
        href: "/tenants/initech-labs",
      },
    ],
  };
}

export function shellFixture(): ShellSummary {
  return {
    nav: { reconcileRuns: 12, drift: 7 },
    dependencies: [
      { name: "Zitadel", status: "ok" },
      { name: "OpenFGA", status: "ok" },
      { name: "Postgres", status: "ok" },
      { name: "Redis", status: "degraded" },
    ],
  };
}
