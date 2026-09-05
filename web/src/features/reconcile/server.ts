import "server-only";

import {
  FIXTURE_NOW,
  LIVE_SCRIPTS,
  PLATFORM_STATS,
  RETRY_CHANGE_DURATION_MS,
  TENANT_STATS,
  WINDOW_LABEL,
  reconcileRunFixtures,
  type LiveStep,
} from "./fixtures";
import { shortId } from "./lib";
import {
  RunDetailSchema,
  RunPageSchema,
  type ChangeOutcome,
  type RunDetail,
  type RunListFilter,
  type RunPage,
  type RunStats,
  type RunSummary,
} from "./schemas";

/**
 * Server-side access to reconcile runs. Pages call these directly; the BFF
 * routes under /api/reconcile-runs call the same functions, so both paths
 * return the identical, schema-checked shape.
 *
 * Fixtures until AuthzPlane.Api exposes GET /v1/reconcile-runs. The store is a
 * module-level Map so mutations (retry) and live runs are visible across
 * requests within one process. It resets on restart; that is deliberate.
 */

interface Store {
  runs: Map<string, RunDetail>;
  /** live script step counter per run id */
  liveStep: Map<string, number>;
  /** scripts for runs created at runtime (retries) merged over the fixture scripts */
  scripts: Map<string, LiveStep[]>;
  /** Idempotency-Key -> run id, so a replayed POST returns the same run */
  retriesByKey: Map<string, string>;
}

let store: Store | undefined;

function seed(): Store {
  const runs = new Map<string, RunDetail>();
  for (const run of reconcileRunFixtures(new Date(FIXTURE_NOW))) runs.set(run.id, run);
  return {
    runs,
    liveStep: new Map(),
    scripts: new Map(Object.entries(LIVE_SCRIPTS)),
    retriesByKey: new Map(),
  };
}

function db(): Store {
  store ??= seed();
  return store;
}

/** Tests call this between cases so the module-level store starts clean. */
export function resetReconcileStoreForTests(): void {
  store = undefined;
}

const SUMMARY_KEYS = [
  "id",
  "tenantSlug",
  "trigger",
  "generation",
  "outcome",
  "startedAt",
  "finishedAt",
  "durationMs",
  "traceId",
  "changeOutcomes",
  "driftCount",
  "attempt",
  "retryOf",
] as const satisfies ReadonlyArray<keyof RunSummary>;

function toSummary(run: RunDetail): RunSummary {
  const out = {} as Record<string, unknown>;
  for (const k of SUMMARY_KEYS) out[k] = run[k];
  return out as unknown as RunSummary;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function deriveStats(items: RunSummary[]): RunStats {
  const settled = items.filter((r) => r.finishedAt !== null);
  return {
    runs: items.length,
    medianDurationMs: median(settled.map((r) => r.durationMs)),
    noChangeRatio: items.length ? items.filter((r) => r.outcome === "NoChanges").length / items.length : 0,
    retriesInBackoff: items.filter((r) => r.attempt !== null && r.attempt.n < r.attempt.max).length,
  };
}

export async function listRuns(filter: RunListFilter): Promise<RunPage> {
  let items = [...db().runs.values()]
    .map(toSummary)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

  if (filter.tenant) items = items.filter((r) => r.tenantSlug === filter.tenant);
  if (filter.trigger) items = items.filter((r) => r.trigger === filter.trigger);
  if (filter.outcome) items = items.filter((r) => r.outcome === filter.outcome);

  const narrowed = Boolean(filter.trigger || filter.outcome);
  const stats: RunStats = narrowed
    ? deriveStats(items)
    : filter.tenant
      ? (TENANT_STATS[filter.tenant] ?? deriveStats(items))
      : PLATFORM_STATS;

  // Cursor = id of the last item on the previous page.
  if (filter.cursor) {
    const at = items.findIndex((r) => r.id === filter.cursor);
    items = at >= 0 ? items.slice(at + 1) : [];
  }
  const page = items.slice(0, filter.limit);
  const nextCursor = items.length > filter.limit ? (page[page.length - 1]?.id ?? null) : null;

  return RunPageSchema.parse({
    items: page,
    nextCursor,
    total: stats.runs,
    stats,
    window: WINDOW_LABEL,
    generatedAt: new Date().toISOString(),
  });
}

/**
 * Detail read. Each call advances an in-flight run by one scripted step, so a
 * 1s poll watches the worker log grow line by line until finishedAt is set.
 */
export async function getRun(runId: string): Promise<RunDetail | null> {
  const run = db().runs.get(runId);
  if (!run) return null;
  const next = run.finishedAt === null ? advanceLive(run) : run;
  return RunDetailSchema.parse(next);
}

function advanceLive(run: RunDetail): RunDetail {
  const s = db();
  const script = s.scripts.get(run.id);
  if (!script) return run;
  const i = s.liveStep.get(run.id) ?? 0;
  const step = script[i];
  if (!step) return run;
  s.liveStep.set(run.id, i + 1);

  const startedMs = Date.parse(run.startedAt);
  const changes = run.changes.map((c) => {
    const o = step.changes?.[c.index];
    if (!o) return c;
    return {
      ...c,
      outcome: o,
      note: o === "applied" ? (c.note === "in flight" || c.note === "queued" ? null : c.note) : o === "applying" ? "in flight" : c.note,
      durationMs: o === "applied" ? (c.durationMs ?? RETRY_CHANGE_DURATION_MS) : c.durationMs,
    };
  });
  const next: RunDetail = {
    ...run,
    changes,
    changeOutcomes: changes.map((c) => c.outcome),
    durationMs: step.durationMs,
    log: [...run.log, { ts: new Date(startedMs + step.log.offsetMs).toISOString(), level: step.log.level, text: step.log.text }],
    ...(step.finish
      ? {
          outcome: step.finish.outcome,
          phases: step.finish.phases,
          finishedAt: new Date(startedMs + step.durationMs).toISOString(),
          facts: { ...run.facts, advisoryLockHeldMs: step.durationMs },
        }
      : {}),
  };
  s.runs.set(run.id, next);
  return next;
}

export type RetryResult =
  | { ok: true; runId: string }
  | { ok: false; status: 404 | 409; title: string; detail: string };

/**
 * Enqueues a manual retry of a settled run. Returns the new run id (202
 * semantics: the run starts Applying and settles over subsequent polls).
 * Replaying the same Idempotency-Key returns the run the first call created.
 */
export async function retryRun(runId: string, idempotencyKey: string): Promise<RetryResult> {
  const s = db();
  const replay = s.retriesByKey.get(idempotencyKey);
  if (replay) return { ok: true, runId: replay };

  const original = s.runs.get(runId);
  if (!original) return { ok: false, status: 404, title: "Run not found", detail: `No reconcile run ${runId}.` };
  if (original.finishedAt === null) {
    return {
      ok: false,
      status: 409,
      title: "Run still in flight",
      detail: `Run ${shortId(runId)} has not finished; wait for it to settle before retrying.`,
    };
  }

  const id = newRunId();
  const startedAt = new Date().toISOString();
  const changes = original.changes.map((c, i) => ({
    index: c.index,
    kind: c.kind,
    description: c.description,
    note: i === 0 ? "in flight" : "queued",
    durationMs: null,
    outcome: (i === 0 ? "applying" : "pending") as ChangeOutcome,
  }));
  const run: RunDetail = {
    ...original,
    id,
    trigger: "manual",
    outcome: "Applying",
    startedAt,
    finishedAt: null,
    durationMs: 120,
    traceId: `${id}${id.slice(0, 8)}`,
    changeOutcomes: changes.map((c) => c.outcome),
    driftCount: 0,
    // A manual retry starts a fresh attempt series; backoff counters belong to the worker.
    attempt: null,
    retryOf: original.id,
    phases: [
      { name: "plan", durationMs: 120, tone: "ready", weight: 1 },
      { name: "read actual", durationMs: 0, tone: "link", weight: 2 },
      { name: `apply 1–${changes.length}`, durationMs: 0, tone: "link", weight: 3 },
    ],
    changes,
    facts: {
      ...original.facts,
      advisoryLockHeldMs: null,
      outboxMessageId: null,
      snapshotKey: changes.length ? `r2://snapshots/${original.tenantSlug}/${id}.json` : null,
    },
    log: [
      { ts: startedAt, level: "info", text: `claimed manual retry of ${shortId(original.id)}` },
      { ts: startedAt, level: "info", text: "acquired advisory lock" },
    ],
    traceUrl: `https://traces.authz-plane.example/trace/${id}${id.slice(0, 8)}`,
    snapshot: { ...original.snapshot, runId: id, retryOf: original.id, takenAt: startedAt },
  };

  s.runs.set(id, run);
  s.scripts.set(id, retryScript(run));
  s.retriesByKey.set(idempotencyKey, id);
  return { ok: true, runId: id };
}

/** The retry replays every change of the original, one per poll, then settles Applied. */
function retryScript(run: RunDetail): LiveStep[] {
  const read = 500;
  const steps: LiveStep[] = [
    { log: { offsetMs: read, level: "info", text: `read actual · plan: ${run.changes.length} change${run.changes.length === 1 ? "" : "s"}` }, durationMs: read },
  ];
  run.changes.forEach((c, i) => {
    const at = read + RETRY_CHANGE_DURATION_MS * (i + 1);
    const next = run.changes[i + 1];
    steps.push({
      log: { offsetMs: at, level: "ready", text: `change ${c.index} ok` },
      changes: { [c.index]: "applied", ...(next ? { [next.index]: "applying" as const } : {}) },
      durationMs: at,
    });
  });
  const total = read + RETRY_CHANGE_DURATION_MS * run.changes.length + 60;
  steps.push({
    log: { offsetMs: total, level: "ready", text: `phase Ready, observedGeneration ${run.generation} · lock released` },
    durationMs: total,
    finish: {
      outcome: "Applied",
      phases: [
        { name: "plan", durationMs: 120, tone: "ready", weight: 1 },
        { name: "read actual", durationMs: read - 120, tone: "link", weight: 2 },
        { name: `apply 1–${run.changes.length}`, durationMs: total - read, tone: "ready", weight: 3 },
      ],
    },
  });
  return steps;
}

function newRunId(): string {
  let id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  while (db().runs.has(id)) id = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  return id;
}
