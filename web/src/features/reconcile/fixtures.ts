import type {
  ChangeOutcome,
  LogLevel,
  LogLine,
  Outcome,
  RunChange,
  RunDetail,
  RunPhase,
  RunStats,
  RunSummary,
} from "./schemas";

/**
 * Deterministic reconcile-run fixtures for screens 08 and 09. Every run
 * belongs to a canonical tenant from features/tenants/fixtures.ts and tells
 * the same story: acme-air is Degraded after run 8f1c…d2 partially applied
 * generation 9; northwind-rail exhausted 8/8 backoff attempts in 2c77…13;
 * initech-labs is mid-apply on generation 7 (the live run); globex-logistics
 * has 4 open drift findings from a resync. All ids, hashes and names are
 * fictional. `now` is a parameter so nothing here reads the clock.
 */

export const FIXTURE_NOW = "2026-09-04T10:15:00Z";

/** Run ids other screens link to. */
export const RUN_IDS = {
  acmePartial: "8f1c9e4b27d2",
  acmeUsersResync: "71a0c3d9e5f2",
  northwindExhausted: "2c77e0b9a413",
  initechLive: "c0127be4d9a6",
  globexDrift: "a7d30f5c81e9",
  wayneDeleting: "9c74a2e6f1b8",
} as const;

const TRACE_BASE = "https://traces.authz-plane.example/trace/";

const iso = (ms: number) => new Date(ms).toISOString();

interface RunSeed {
  id: string;
  tenantSlug: string;
  trigger: RunSummary["trigger"];
  generation: number;
  outcome: Outcome;
  /** seconds before `now` the run started */
  startedAgoSeconds: number;
  durationMs: number;
  traceId: string;
  changeOutcomes: ChangeOutcome[];
  driftCount?: number;
  attempt?: RunSummary["attempt"];
  worker?: string;
  specHash: string;
  actualHash: string;
}

/** Tenant spec hashes as features/tenants/fixtures.ts records them. */
const SPEC_HASH: Record<string, string> = {
  "acme-air": "b7e21f04",
  "northwind-rail": "91d0aa3c",
  "globex-logistics": "5c8f1e22",
  "initech-labs": "0fa7d9b1",
  "umbrella-health": "ee41b2c8",
  "stark-freight": "17c3e5f9",
  "wayne-transit": "c9a2f043",
};

const SEEDS: RunSeed[] = [
  {
    id: RUN_IDS.initechLive,
    tenantSlug: "initech-labs",
    trigger: "manual",
    generation: 7,
    outcome: "Applying",
    startedAgoSeconds: 18,
    durationMs: 1100,
    traceId: "9d2e7c41b0a6f38e5c12",
    changeOutcomes: ["applied", "applied", "applied", "applying", "pending"],
    worker: "reconciler-1",
    specHash: SPEC_HASH["initech-labs"]!,
    actualHash: "6b1d9f03a2c4",
  },
  {
    id: RUN_IDS.acmePartial,
    tenantSlug: "acme-air",
    trigger: "outbox",
    generation: 9,
    outcome: "Partial",
    startedAgoSeconds: 38,
    durationMs: 3400,
    traceId: "4bf9e2c7d81a03b6f5a1",
    changeOutcomes: ["applied", "applied", "applied", "failed", "skipped"],
    attempt: { n: 3, max: 8 },
    specHash: SPEC_HASH["acme-air"]!,
    actualHash: "2f08c6a1b49c",
  },
  {
    id: RUN_IDS.wayneDeleting,
    tenantSlug: "wayne-transit",
    trigger: "delete",
    generation: 5,
    outcome: "Deleting",
    startedAgoSeconds: 48,
    durationMs: 6000,
    traceId: "c3a8e51f7d2b906e4a77",
    changeOutcomes: ["applied", "applied", "applying"],
    worker: "reconciler-2",
    specHash: SPEC_HASH["wayne-transit"]!,
    actualHash: "0a3f7e19c5d2",
  },
  {
    id: RUN_IDS.acmeUsersResync,
    tenantSlug: "acme-air",
    trigger: "resync",
    generation: 8,
    outcome: "NoChanges",
    startedAgoSeconds: 180,
    durationMs: 600,
    traceId: "71e0a9c4d2f5b83610ce",
    changeOutcomes: [],
    worker: "reconciler-1",
    specHash: "a91c3e58",
    actualHash: "a91c3e58",
  },
  {
    id: "2bb84c17e0d5",
    tenantSlug: "umbrella-health",
    trigger: "outbox",
    generation: 12,
    outcome: "Applied",
    startedAgoSeconds: 190,
    durationMs: 1400,
    traceId: "e5b21c9a7f04d36b8e19",
    changeOutcomes: ["applied", "applied"],
    specHash: SPEC_HASH["umbrella-health"]!,
    actualHash: SPEC_HASH["umbrella-health"]!,
  },
  {
    id: RUN_IDS.globexDrift,
    tenantSlug: "globex-logistics",
    trigger: "resync",
    generation: 6,
    outcome: "Drift",
    startedAgoSeconds: 360,
    durationMs: 900,
    traceId: "a7d3f5c10e8b2946d3c0",
    changeOutcomes: [],
    driftCount: 4,
    worker: "reconciler-2",
    specHash: SPEC_HASH["globex-logistics"]!,
    actualHash: "d47a20e9b1f6",
  },
  {
    id: "d4a19c3e72b0",
    tenantSlug: "stark-freight",
    trigger: "outbox",
    generation: 2,
    outcome: "Applied",
    startedAgoSeconds: 540,
    durationMs: 1200,
    traceId: "3f9c0b7e2a1d58c4e6b2",
    changeOutcomes: ["applied"],
    specHash: SPEC_HASH["stark-freight"]!,
    actualHash: SPEC_HASH["stark-freight"]!,
  },
  {
    id: "08ad5e7f1c93",
    tenantSlug: "initech-labs",
    trigger: "resync",
    generation: 6,
    outcome: "NoChanges",
    startedAgoSeconds: 660,
    durationMs: 400,
    traceId: "08ad1e6f5c93b2d7a041",
    changeOutcomes: [],
    worker: "reconciler-1",
    specHash: "4e7b2c90",
    actualHash: "4e7b2c90",
  },
  {
    id: "e37f2a90b4d1",
    tenantSlug: "umbrella-health",
    trigger: "resync",
    generation: 12,
    outcome: "NoChanges",
    startedAgoSeconds: 780,
    durationMs: 700,
    traceId: "e37fb6d2094ac15e83f7",
    changeOutcomes: [],
    worker: "reconciler-2",
    specHash: SPEC_HASH["umbrella-health"]!,
    actualHash: SPEC_HASH["umbrella-health"]!,
  },
  {
    id: "5b6e0d8a2f47",
    tenantSlug: "globex-logistics",
    trigger: "resync",
    generation: 6,
    outcome: "NoChanges",
    startedAgoSeconds: 960,
    durationMs: 500,
    traceId: "5b6e93a1d0f7c24e8b05",
    changeOutcomes: [],
    specHash: SPEC_HASH["globex-logistics"]!,
    actualHash: SPEC_HASH["globex-logistics"]!,
  },
  {
    id: RUN_IDS.northwindExhausted,
    tenantSlug: "northwind-rail",
    trigger: "backoff",
    generation: 4,
    outcome: "Failed",
    startedAgoSeconds: 1440,
    durationMs: 2200,
    traceId: "2c77d9e1a4b30f68c5e2",
    changeOutcomes: ["failed"],
    attempt: { n: 8, max: 8 },
    worker: "reconciler-2",
    specHash: SPEC_HASH["northwind-rail"]!,
    actualHash: "f1c5a8d20b73",
  },
  {
    id: "f61c3b8d90e2",
    tenantSlug: "stark-freight",
    trigger: "resync",
    generation: 2,
    outcome: "NoChanges",
    startedAgoSeconds: 1740,
    durationMs: 500,
    traceId: "f61c7a2e94d0b5c83a16",
    changeOutcomes: [],
    worker: "reconciler-1",
    specHash: SPEC_HASH["stark-freight"]!,
    actualHash: SPEC_HASH["stark-freight"]!,
  },
  {
    id: "4e59d8b1c37a",
    tenantSlug: "northwind-rail",
    trigger: "backoff",
    generation: 4,
    outcome: "Failed",
    startedAgoSeconds: 2400,
    durationMs: 2000,
    traceId: "4e59c2a7f81d0b36e9a4",
    changeOutcomes: ["failed"],
    attempt: { n: 7, max: 8 },
    worker: "reconciler-0",
    specHash: SPEC_HASH["northwind-rail"]!,
    actualHash: "f1c5a8d20b73",
  },
  {
    id: "b9e24f7a0c15",
    tenantSlug: "acme-air",
    trigger: "outbox",
    generation: 8,
    outcome: "Applied",
    startedAgoSeconds: 5700,
    durationMs: 2100,
    traceId: "b9e2a04d7c1f5e38b6a9",
    changeOutcomes: ["applied", "applied", "applied", "applied"],
    specHash: "a91c3e58",
    actualHash: "a91c3e58",
  },
];

function summaryOf(seed: RunSeed, now: Date): RunSummary {
  const startedMs = now.getTime() - seed.startedAgoSeconds * 1000;
  const inFlight = seed.outcome === "Applying" || seed.outcome === "Deleting";
  return {
    id: seed.id,
    tenantSlug: seed.tenantSlug,
    trigger: seed.trigger,
    generation: seed.generation,
    outcome: seed.outcome,
    startedAt: iso(startedMs),
    finishedAt: inFlight ? null : iso(startedMs + seed.durationMs),
    durationMs: seed.durationMs,
    traceId: seed.traceId,
    changeOutcomes: seed.changeOutcomes,
    driftCount: seed.driftCount ?? 0,
    attempt: seed.attempt ?? null,
    retryOf: null,
  };
}

/** Log line `offsetMs` after the run started. */
function line(startedAt: string, offsetMs: number, level: LogLevel, text: string): LogLine {
  return { ts: iso(Date.parse(startedAt) + offsetMs), level, text };
}

const GENERIC_KINDS = ["zitadel.org", "zitadel.idp", "fga.model", "plane.role", "fga.tuple", "fga.tuple"] as const;
const GENERIC_DESCRIPTIONS = [
  "ensure org exists",
  "update primary idp claim mappings",
  "write authorization model",
  "create role tenant_viewer",
  "write user:ops tenant_admin tenant",
  "delete stale tuple folder:archive",
] as const;

function genericChanges(outcomes: ChangeOutcome[], durations: number[]): RunChange[] {
  return outcomes.map((outcome, i) => ({
    index: i + 1,
    kind: GENERIC_KINDS[i % GENERIC_KINDS.length]!,
    description: GENERIC_DESCRIPTIONS[i % GENERIC_DESCRIPTIONS.length]!,
    note: outcome === "applied" ? (i === 0 ? "idempotent hit" : null) : outcome === "pending" ? "queued" : null,
    durationMs: outcome === "applied" || outcome === "failed" ? (durations[i] ?? 200) : null,
    outcome,
  }));
}

/** Waterfall + changes + log for runs the frames do not single out. */
function genericDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  const plan = 120;
  const read = Math.max(300, Math.round(s.durationMs * 0.35));
  const rest = Math.max(0, s.durationMs - plan - read);

  if (s.outcome === "NoChanges") {
    return {
      phases: [
        { name: "plan", durationMs: plan, tone: "ready", weight: 1 },
        { name: "read actual", durationMs: read, tone: "link", weight: 3 },
        { name: "compare", durationMs: rest, tone: "ready", weight: 1 },
      ],
      changes: [],
      log: [
        line(s.startedAt, 0, "info", `claimed ${s.trigger} tick`),
        line(s.startedAt, 40, "info", "acquired advisory lock"),
        line(s.startedAt, plan + read, "info", "read actual: hashes match desired"),
        line(s.startedAt, s.durationMs - 20, "ready", "phase Ready, no changes"),
        line(s.startedAt, s.durationMs, "info", "lock released"),
      ],
    };
  }

  const n = s.changeOutcomes.length;
  const per = n ? Math.max(60, Math.round(rest / n)) : 0;
  const durations = s.changeOutcomes.map(() => per);
  const applying = s.outcome === "Applying" || s.outcome === "Deleting";
  const applyName = s.outcome === "Deleting" ? `finalizers 1–${n}` : `apply 1–${n}`;
  const log: LogLine[] = [
    line(s.startedAt, 0, "info", `claimed ${s.trigger} message`),
    line(s.startedAt, 30, "info", "acquired advisory lock"),
    line(s.startedAt, plan + read, "info", `plan: ${n} change${n === 1 ? "" : "s"}`),
  ];
  s.changeOutcomes.forEach((o, i) => {
    if (o === "applied") log.push(line(s.startedAt, plan + read + per * (i + 1), "ready", `change ${i + 1} ok`));
  });
  if (!applying) {
    log.push(line(s.startedAt, s.durationMs - 10, "ready", `phase Ready, observedGeneration ${s.generation}`));
    log.push(line(s.startedAt, s.durationMs, "info", "lock released, msg acked"));
  }
  return {
    phases: [
      { name: "plan", durationMs: plan, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: read, tone: "link", weight: 2 },
      { name: applyName, durationMs: rest, tone: applying ? "link" : "ready", weight: 3 },
    ],
    changes: genericChanges(s.changeOutcomes, durations),
    log,
  };
}

function acmePartialDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  return {
    phases: [
      { name: "plan", durationMs: 180, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 640, tone: "link", weight: 2 },
      { name: "apply 1–3", durationMs: 1100, tone: "ready", weight: 3 },
      { name: "change 4 timeout", durationMs: 3000, tone: "failed", weight: 2 },
    ],
    changes: [
      { index: 1, kind: "zitadel.idp", description: "update acme-entra secret", note: "idempotent hit", durationMs: 210, outcome: "applied" },
      { index: 2, kind: "fga.model", description: "write authorization model v7", note: "new external id", durationMs: 430, outcome: "applied" },
      { index: 3, kind: "plane.role", description: "create role tenant_auditor", note: null, durationMs: 92, outcome: "applied" },
      {
        index: 4,
        kind: "fga.tuple",
        description: "write user:mira auditor tenant:acme-air",
        note: "Timeout",
        durationMs: 3000,
        outcome: "failed",
        error: {
          type: "/errors/downstream-timeout",
          title: "Timeout",
          changeKey: "2ab7f13c9e6d",
          attempt: 3,
          maxAttempts: 8,
          nextRetrySeconds: 45,
          detail: "OpenFGA WriteTuples exceeded 3000ms budget; circuit half-open",
        },
      },
      { index: 5, kind: "fga.tuple", description: "delete user:dana editor folder:finance", note: "skipped — run aborted after failure", durationMs: null, outcome: "skipped" },
    ],
    log: [
      line(s.startedAt, 0, "info", "claimed outbox message"),
      line(s.startedAt, 120, "info", "acquired advisory lock"),
      line(s.startedAt, 820, "info", "read actual: org, 1 idp, 1284 tuples"),
      line(s.startedAt, 900, "info", "plan: 3 create, 1 update, 1 delete"),
      line(s.startedAt, 980, "info", "snapshot written 42KB"),
      line(s.startedAt, 1560, "ready", "change 1 ok"),
      line(s.startedAt, 1990, "ready", "change 2 ok"),
      line(s.startedAt, 2080, "ready", "change 3 ok"),
      line(s.startedAt, 5080, "failed", "change 4 timeout, aborting"),
      line(s.startedAt, 5090, "degraded", "phase Degraded, retry at 10:15:12"),
      line(s.startedAt, 5100, "info", "lock released, msg requeued"),
    ],
  };
}

function acmeUsersResyncDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  return {
    phases: [
      { name: "plan", durationMs: 90, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 480, tone: "link", weight: 4 },
      { name: "compare", durationMs: 30, tone: "ready", weight: 1 },
    ],
    changes: [],
    log: [
      line(s.startedAt, 0, "info", "claimed resync tick"),
      line(s.startedAt, 20, "info", "acquired advisory lock"),
      line(s.startedAt, 570, "info", "read actual: org, 1 idp, 312 users, 1284 tuples"),
      line(s.startedAt, 580, "info", "users mirror refreshed (312 rows)"),
      line(s.startedAt, 590, "ready", "phase Ready, no changes"),
      line(s.startedAt, 600, "info", "lock released"),
    ],
  };
}

function globexDriftDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  return {
    phases: [
      { name: "plan", durationMs: 120, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 610, tone: "link", weight: 3 },
      { name: "compare · 4 drift", durationMs: 170, tone: "drift", weight: 1 },
    ],
    changes: [],
    log: [
      line(s.startedAt, 0, "info", "claimed resync tick"),
      line(s.startedAt, 30, "info", "acquired advisory lock"),
      line(s.startedAt, 730, "info", "read actual: org, 1 idp, 240 tuples"),
      line(s.startedAt, 880, "degraded", "actualHash ≠ specHash · 4 field paths differ"),
      line(s.startedAt, 890, "info", "no matching audit event in authz-plane → out-of-band change"),
      line(s.startedAt, 895, "info", "autoHeal off · 4 findings opened, nothing written"),
      line(s.startedAt, 900, "info", "lock released"),
    ],
  };
}

function northwindExhaustedDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  return {
    phases: [
      { name: "plan", durationMs: 160, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 540, tone: "link", weight: 2 },
      { name: "change 1 rejected", durationMs: 1500, tone: "failed", weight: 3 },
    ],
    changes: [
      {
        index: 1,
        kind: "zitadel.idp",
        description: "create idp northwind-okta",
        note: "BadRequest",
        durationMs: 1500,
        outcome: "failed",
        error: {
          type: "/errors/invalid-idp-config",
          title: "BadRequest",
          changeKey: "c81e4a9f2d07",
          attempt: 8,
          maxAttempts: 8,
          nextRetrySeconds: null,
          detail: "Zitadel CreateIdentityProvider returned 400 invalid_idp_config: discovery document has no jwks_uri",
        },
      },
    ],
    log: [
      line(s.startedAt, 0, "info", "claimed backoff message (attempt 8/8)"),
      line(s.startedAt, 40, "info", "acquired advisory lock"),
      line(s.startedAt, 700, "info", "read actual: org absent"),
      line(s.startedAt, 720, "info", "plan: 1 create"),
      line(s.startedAt, 2200, "failed", "change 1 rejected: 400 invalid_idp_config"),
      line(s.startedAt, 2200, "failed", "phase Failed, attempts exhausted (8/8)"),
      line(s.startedAt, 2200, "info", "lock released, msg dead-lettered"),
    ],
  };
}

function initechLiveDetail(s: RunSummary): Pick<RunDetail, "phases" | "changes" | "log"> {
  return {
    phases: [
      { name: "plan", durationMs: 140, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 520, tone: "link", weight: 2 },
      { name: "apply 1–5", durationMs: 440, tone: "link", weight: 3 },
    ],
    changes: [
      { index: 1, kind: "zitadel.idp", description: "update initech-okta claim mappings", note: "idempotent hit", durationMs: 160, outcome: "applied" },
      { index: 2, kind: "fga.model", description: "write authorization model v4", note: "new external id", durationMs: 210, outcome: "applied" },
      { index: 3, kind: "plane.role", description: "create role tenant_editor", note: null, durationMs: 70, outcome: "applied" },
      { index: 4, kind: "fga.tuple", description: "write user:sam editor tenant:initech-labs", note: "in flight", durationMs: null, outcome: "applying" },
      { index: 5, kind: "fga.tuple", description: "write user:lee viewer tenant:initech-labs", note: "queued", durationMs: null, outcome: "pending" },
    ],
    log: [
      line(s.startedAt, 0, "info", "claimed manual reconcile"),
      line(s.startedAt, 30, "info", "acquired advisory lock"),
      line(s.startedAt, 660, "info", "read actual: org, 1 idp, 240 tuples"),
      line(s.startedAt, 680, "info", "plan: 3 create, 2 update"),
      line(s.startedAt, 700, "info", "snapshot written 18KB"),
      line(s.startedAt, 860, "ready", "change 1 ok"),
      line(s.startedAt, 1070, "ready", "change 2 ok"),
      line(s.startedAt, 1100, "ready", "change 3 ok"),
    ],
  };
}

const SPECIAL: Record<string, (s: RunSummary) => Pick<RunDetail, "phases" | "changes" | "log">> = {
  [RUN_IDS.acmePartial]: acmePartialDetail,
  [RUN_IDS.acmeUsersResync]: acmeUsersResyncDetail,
  [RUN_IDS.globexDrift]: globexDriftDetail,
  [RUN_IDS.northwindExhausted]: northwindExhaustedDetail,
  [RUN_IDS.initechLive]: initechLiveDetail,
};

function detailOf(seed: RunSeed, now: Date): RunDetail {
  const s = summaryOf(seed, now);
  const body = (SPECIAL[seed.id] ?? genericDetail)(s);
  const hasSnapshot = s.changeOutcomes.length > 0;
  const snapshotKey = hasSnapshot ? `r2://snapshots/${s.tenantSlug}/${s.id}.json` : null;
  return {
    ...s,
    ...body,
    facts: {
      advisoryLockHeldMs: s.finishedAt ? s.durationMs : null,
      outboxMessageId: seed.trigger === "outbox" || seed.trigger === "backoff" ? outboxMessageId(seed.id) : null,
      worker: seed.worker ?? "reconciler-0",
      snapshotKey,
      specHash: seed.specHash,
      actualHash: seed.actualHash,
    },
    traceUrl: `${TRACE_BASE}${seed.traceId}`,
    snapshot: {
      runId: s.id,
      tenant: s.tenantSlug,
      generation: s.generation,
      takenAt: s.startedAt,
      specHash: seed.specHash,
      actualHash: seed.actualHash,
      key: snapshotKey,
      changes: body.changes.map((c) => ({ index: c.index, kind: c.kind, description: c.description })),
    },
  };
}

/** Stable per-run outbox message id derived from the run id, so it never changes between renders. */
function outboxMessageId(runId: string): string {
  return runId === RUN_IDS.acmePartial ? "e91b7a2c064f" : [...runId].reverse().join("");
}

export function reconcileRunFixtures(now: Date): RunDetail[] {
  return SEEDS.map((seed) => detailOf(seed, now));
}

/** Headline numbers for the platform-wide list (frame 08). */
export const PLATFORM_STATS: RunStats = {
  runs: 318,
  medianDurationMs: 1900,
  noChangeRatio: 0.71,
  retriesInBackoff: 3,
};

/** Per-tenant totals the tenant sidebar and the tenant-scoped list report. */
export const TENANT_STATS: Record<string, RunStats> = {
  "acme-air": { runs: 31, medianDurationMs: 2100, noChangeRatio: 0.68, retriesInBackoff: 1 },
};

/** Window label; the fixtures cover the last 6h. */
export const WINDOW_LABEL = "last 6h";

/* ------------------------------------------------------------------------ */
/* Live scripts: how in-flight runs advance one step per poll.               */
/* ------------------------------------------------------------------------ */

export interface LiveStep {
  /** appended to the worker log; offset from startedAt */
  log: { offsetMs: number; level: LogLevel; text: string };
  /** change index -> new outcome */
  changes?: Record<number, ChangeOutcome>;
  /** running duration after this step */
  durationMs: number;
  /** present on the last step: the run settles */
  finish?: { outcome: Outcome; phases: RunPhase[] };
}

/**
 * initech-labs finishes generation 7 in four polls; wayne-transit's delete
 * logs two finalizers and then stays Deleting (the tenant fixture is
 * permanently Deleting, so this run never settles). The step counter lives in
 * server.ts and resets on process restart.
 */
export const LIVE_SCRIPTS: Record<string, LiveStep[]> = {
  [RUN_IDS.initechLive]: [
    { log: { offsetMs: 1600, level: "ready", text: "change 4 ok" }, changes: { 4: "applied", 5: "applying" }, durationMs: 1600 },
    { log: { offsetMs: 1900, level: "ready", text: "change 5 ok" }, changes: { 5: "applied" }, durationMs: 1900 },
    { log: { offsetMs: 2000, level: "link", text: "observedGeneration 6 → 7" }, durationMs: 2000 },
    {
      log: { offsetMs: 2100, level: "ready", text: "phase Ready, lock released, msg acked" },
      durationMs: 2100,
      finish: {
        outcome: "Applied",
        phases: [
          { name: "plan", durationMs: 140, tone: "ready", weight: 1 },
          { name: "read actual", durationMs: 520, tone: "link", weight: 2 },
          { name: "apply 1–5", durationMs: 1440, tone: "ready", weight: 3 },
        ],
      },
    },
  ],
  [RUN_IDS.wayneDeleting]: [
    { log: { offsetMs: 6400, level: "link", text: "finalizer fga.store: 96 tuples purged" }, durationMs: 6400 },
    { log: { offsetMs: 7100, level: "link", text: "finalizer zitadel.org: deactivate requested, awaiting callback" }, durationMs: 7100 },
  ],
};

/** Applied-change durations for a retried run; the retry replays every change of the original. */
export const RETRY_CHANGE_DURATION_MS = 180;
