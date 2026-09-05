import { z } from "zod";

/**
 * Wire shapes for reconcile runs (handoff screens 08 and 09). Client-safe:
 * no server imports. The BFF routes under /api/reconcile-runs and the pages
 * both parse against these, so the fixtures and the eventual .NET mapping
 * cannot drift apart silently.
 */

export const TriggerSchema = z.enum(["outbox", "resync", "manual", "backoff", "delete"]);
export type Trigger = z.infer<typeof TriggerSchema>;
export const TRIGGERS = TriggerSchema.options;

/** Run-level outcome as the table shows it. The detail chip spells "Partial" out as PartiallyApplied. */
export const OutcomeSchema = z.enum([
  "Partial",
  "Drift",
  "Applying",
  "NoChanges",
  "Failed",
  "Applied",
  "Deleting",
]);
export type Outcome = z.infer<typeof OutcomeSchema>;
export const OUTCOMES = OutcomeSchema.options;

export const OUTCOME_LABELS: Record<Outcome, string> = {
  Partial: "PartiallyApplied",
  Drift: "Drift",
  Applying: "Applying",
  NoChanges: "NoChanges",
  Failed: "Failed",
  Applied: "Applied",
  Deleting: "Deleting",
};

/** Per-change outcome; each maps to one 24×5px segment in the list and one row in the detail. */
export const ChangeOutcomeSchema = z.enum([
  "applied",
  "failed",
  "retrying",
  "applying",
  "pending",
  "skipped",
]);
export type ChangeOutcome = z.infer<typeof ChangeOutcomeSchema>;

export const RunAttemptSchema = z.object({
  n: z.number().int().positive(),
  max: z.number().int().positive(),
});
export type RunAttempt = z.infer<typeof RunAttemptSchema>;

export const RunSummarySchema = z.object({
  /** 12 hex chars; the UI shows `8f1c…d2` */
  id: z.string().regex(/^[0-9a-f]{12}$/),
  tenantSlug: z.string().min(1),
  trigger: TriggerSchema,
  generation: z.number().int().positive(),
  outcome: OutcomeSchema,
  startedAt: z.string(),
  /** null while the worker still holds the run */
  finishedAt: z.string().nullable(),
  durationMs: z.number().int().nonnegative(),
  traceId: z.string().min(8),
  /** ordered per-change outcomes; empty for no-change and drift-only runs */
  changeOutcomes: z.array(ChangeOutcomeSchema),
  /** drift findings a resync surfaced (Drift outcome) */
  driftCount: z.number().int().nonnegative(),
  /** backoff attempt counter; null for first attempts */
  attempt: RunAttemptSchema.nullable(),
  /** the run this one retries, if any */
  retryOf: z.string().nullable(),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

export const PhaseToneSchema = z.enum(["ready", "link", "degraded", "failed", "drift", "neutral"]);
export type PhaseTone = z.infer<typeof PhaseToneSchema>;

/** One bar of the phase waterfall. `weight` is the flex share; durations are not linear in the frame. */
export const RunPhaseSchema = z.object({
  name: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  tone: PhaseToneSchema,
  weight: z.number().positive(),
});
export type RunPhase = z.infer<typeof RunPhaseSchema>;

export const ChangeErrorSchema = z.object({
  /** problem+json type, e.g. /errors/downstream-timeout */
  type: z.string().min(1),
  title: z.string().min(1),
  changeKey: z.string().min(1),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  /** seconds until the next attempt, jittered; null when exhausted */
  nextRetrySeconds: z.number().int().nonnegative().nullable(),
  detail: z.string().min(1),
});
export type ChangeError = z.infer<typeof ChangeErrorSchema>;

export const RunChangeSchema = z.object({
  index: z.number().int().positive(),
  /** resource kind, e.g. zitadel.idp, fga.model, plane.role, fga.tuple */
  kind: z.string().min(1),
  description: z.string().min(1),
  /** "idempotent hit", "new external id", … ; null renders as an em dash */
  note: z.string().nullable(),
  durationMs: z.number().int().nonnegative().nullable(),
  outcome: ChangeOutcomeSchema,
  error: ChangeErrorSchema.optional(),
});
export type RunChange = z.infer<typeof RunChangeSchema>;

export const RunFactsSchema = z.object({
  advisoryLockHeldMs: z.number().int().nonnegative().nullable(),
  outboxMessageId: z.string().nullable(),
  worker: z.string().min(1),
  snapshotKey: z.string().nullable(),
  specHash: z.string().min(1),
  actualHash: z.string().min(1),
});
export type RunFacts = z.infer<typeof RunFactsSchema>;

export const LogLevelSchema = z.enum(["info", "ready", "link", "degraded", "failed"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;

export const LogLineSchema = z.object({
  ts: z.string(),
  level: LogLevelSchema,
  text: z.string().min(1),
});
export type LogLine = z.infer<typeof LogLineSchema>;

export const RunDetailSchema = RunSummarySchema.extend({
  phases: z.array(RunPhaseSchema),
  changes: z.array(RunChangeSchema),
  facts: RunFactsSchema,
  log: z.array(LogLineSchema),
  /** external trace URL for "Open trace ↗" */
  traceUrl: z.url(),
  /** pre-apply snapshot body, downloaded as JSON from the detail header */
  snapshot: z.record(z.string(), z.unknown()),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const RunListFilterSchema = z.object({
  trigger: TriggerSchema.optional(),
  outcome: OutcomeSchema.optional(),
  tenant: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type RunListFilter = z.infer<typeof RunListFilterSchema>;
/** What callers pass before defaults apply. */
export type RunListFilterInput = z.input<typeof RunListFilterSchema>;

export const RunStatsSchema = z.object({
  runs: z.number().int().nonnegative(),
  medianDurationMs: z.number().int().nonnegative(),
  /** 0..1 share of runs that produced no changes */
  noChangeRatio: z.number().min(0).max(1),
  retriesInBackoff: z.number().int().nonnegative(),
});
export type RunStats = z.infer<typeof RunStatsSchema>;

export const RunPageSchema = z.object({
  items: z.array(RunSummarySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  stats: RunStatsSchema,
  /** window label the topbar meta shows, e.g. "last 6h" */
  window: z.string().min(1),
  generatedAt: z.string(),
});
export type RunPage = z.infer<typeof RunPageSchema>;

/** 202 body from POST /api/reconcile-runs/{id}/retry */
export const RetryResponseSchema = z.object({
  runId: RunSummarySchema.shape.id,
});
export type RetryResponse = z.infer<typeof RetryResponseSchema>;
