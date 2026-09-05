import "server-only";

import { listRuns, retryRun } from "@/features/reconcile/server";
import { RunListFilterSchema } from "@/features/reconcile/schemas";
import { getTenant } from "@/features/tenants/server";
import { diffLines, summarize } from "./diff";
import { acmeVersions, genericVersions, planFixture, versionStatus } from "./fixtures";
import { fnv1a } from "./hash";
import {
  PlanSchema,
  ReconcileAcceptedSchema,
  SaveSpecResponseSchema,
  SpecDocumentSchema,
  SpecVersionsSchema,
  ValidationResponseSchema,
  type Plan,
  type ReconcileAccepted,
  type SaveSpecResponse,
  type SpecDocument,
  type SpecVersion,
  type SpecVersions,
  type ValidationResponse,
} from "./schemas";
import { validateSpecBody } from "./validate";

/**
 * Server-side spec access for screens 05–07. Pages call these directly; the
 * BFF routes under /api/tenants/{slug}/spec call the same functions, so both
 * return the identical schema-checked shape.
 *
 * Fixtures until AuthzPlane.Api exposes GET/PUT /v1/tenants/{id}/spec. Saves
 * and restores land in an in-memory store so the UI reacts (a new generation
 * appears, If-Match moves on). The store is process-local and resets on
 * restart; it hangs off globalThis because the dev server loads this module
 * once per route bundle. The tenant projection (features/tenants) is not
 * ours to mutate, so its `generation` stays at the fixture value after a save.
 */

interface TenantSpecState {
  /** newest first */
  versions: SpecVersion[];
  currentGeneration: number;
  observedGeneration: number;
  /** Idempotency-Key → response, so a replayed PUT/restore returns the same generation */
  byKey: Map<string, SaveSpecResponse>;
}

const STORE_KEY = Symbol.for("authz-plane.spec.store");

function store(): Map<string, TenantSpecState> {
  const g = globalThis as unknown as Record<symbol, Map<string, TenantSpecState> | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

/** Tests only. */
export function resetSpecStoreForTests(): void {
  store().clear();
}

async function stateFor(slug: string): Promise<TenantSpecState | null> {
  const existing = store().get(slug);
  if (existing) return existing;
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const versions = slug === "acme-air" ? acmeVersions() : genericVersions(tenant);
  const state: TenantSpecState = {
    versions,
    currentGeneration: versions[0]?.generation ?? tenant.generation,
    observedGeneration: tenant.observedGeneration,
    byKey: new Map(),
  };
  store().set(slug, state);
  return state;
}

function current(state: TenantSpecState): SpecVersion {
  return state.versions.find((v) => v.generation === state.currentGeneration) ?? state.versions[0]!;
}

function applied(state: TenantSpecState): SpecVersion | undefined {
  return state.versions.find((v) => v.generation === state.observedGeneration);
}

export async function getSpec(slug: string): Promise<SpecDocument | null> {
  const state = await stateFor(slug);
  if (!state) return null;
  const v = current(state);
  return SpecDocumentSchema.parse({
    slug,
    generation: v.generation,
    body: v.body,
    hash: v.hash,
    lineCount: v.body.split("\n").length,
    updatedAt: v.createdAt,
  });
}

export async function listVersions(slug: string): Promise<SpecVersions | null> {
  const state = await stateFor(slug);
  if (!state) return null;
  return SpecVersionsSchema.parse({
    slug,
    items: state.versions,
    total: state.versions.length,
    currentGeneration: state.currentGeneration,
    observedGeneration: state.observedGeneration,
  });
}

/** Pure check against the applied generation; `durationMs` is measured here, as the real endpoint reports it. */
export async function validateSpec(slug: string, body: string): Promise<ValidationResponse | null> {
  const state = await stateFor(slug);
  if (!state) return null;
  const started = performance.now();
  const outcome = validateSpecBody(body, { appliedBody: applied(state)?.body ?? null });
  // The fixture path is sub-millisecond; floor at the frame's 41ms so the caption reads like a network call.
  const durationMs = Math.max(41, Math.round(performance.now() - started));
  return ValidationResponseSchema.parse({ ...outcome, durationMs });
}

export type SaveResult =
  | { ok: true; data: SaveSpecResponse }
  | { ok: false; status: 400 | 404 | 412 | 428; title: string; detail: string };

/**
 * PUT …/spec with `If-Match: <generation>`. 428 without the header, 412 when
 * the generation moved (handoff: "spec changed underneath you, reload and
 * re-diff"), 400 when validation reports errors. Otherwise appends an
 * immutable version and enqueues a reconcile in the same "transaction".
 */
export async function saveSpec(
  slug: string,
  body: string,
  ifMatch: number | null,
  idempotencyKey: string,
  author: string,
  now: Date,
  summaryOverride?: string,
): Promise<SaveResult> {
  const state = await stateFor(slug);
  if (!state) return { ok: false, status: 404, title: "Tenant not found", detail: `No tenant with slug "${slug}".` };

  const replay = state.byKey.get(idempotencyKey);
  if (replay) return { ok: true, data: replay };

  if (ifMatch === null) {
    return { ok: false, status: 428, title: "If-Match required", detail: "Send If-Match with the generation you edited so a stale write cannot overwrite a newer one." };
  }
  if (ifMatch !== state.currentGeneration) {
    return {
      ok: false,
      status: 412,
      title: "Spec changed underneath you",
      detail: `You edited generation ${ifMatch} but generation ${state.currentGeneration} is now current · reload and re-diff before saving.`,
    };
  }
  const outcome = validateSpecBody(body, { appliedBody: applied(state)?.body ?? null });
  if (!outcome.valid) {
    const first = outcome.results.find((r) => r.level === "error");
    return { ok: false, status: 400, title: "Spec does not validate", detail: first ? `${first.title} · ${first.detail}` : `${outcome.errors} errors` };
  }

  const generation = state.currentGeneration + 1;
  const prev = current(state);
  const version: SpecVersion = {
    generation,
    author,
    createdAt: now.toISOString(),
    hash: fnv1a(body),
    summary: summaryOverride ?? describeChange(prev.body, body),
    status: "current",
    body,
  };
  state.versions = [version, ...state.versions.map((v) => ({ ...v, status: versionStatus(v.generation, generation, state.observedGeneration) }))];
  state.currentGeneration = generation;

  const { runId } = await enqueueReconcile(slug, `${idempotencyKey}:reconcile`, now);
  const data = SaveSpecResponseSchema.parse({ generation, runId });
  state.byKey.set(idempotencyKey, data);
  return { ok: true, data };
}

/** "+2 lines, −3 lines, 1 changed" for the version list; "no field changes" when identical. */
function describeChange(before: string, after: string): string {
  const s = summarize(diffLines(before, after));
  if (s.hunks === 0) return "no field changes";
  const parts: string[] = [];
  if (s.added) parts.push(`+${s.added} line${s.added === 1 ? "" : "s"}`);
  if (s.removed) parts.push(`−${s.removed} line${s.removed === 1 ? "" : "s"}`);
  if (s.changed) parts.push(`${s.changed} changed`);
  return parts.join(", ");
}

export type RestoreResult =
  | { ok: true; data: SaveSpecResponse }
  | { ok: false; status: 400 | 404 | 409; title: string; detail: string };

/** Restore never mutates history: it writes the old body as a new generation. */
export async function restoreVersion(slug: string, generation: number, idempotencyKey: string, author: string, now: Date): Promise<RestoreResult> {
  const state = await stateFor(slug);
  if (!state) return { ok: false, status: 404, title: "Tenant not found", detail: `No tenant with slug "${slug}".` };
  const source = state.versions.find((v) => v.generation === generation);
  if (!source) return { ok: false, status: 404, title: "Version not found", detail: `${slug} has no generation ${generation}.` };
  if (generation === state.currentGeneration) {
    return { ok: false, status: 409, title: "Already current", detail: `Generation ${generation} is the current desired state; nothing to restore.` };
  }
  const result = await saveSpec(slug, source.body, state.currentGeneration, idempotencyKey, author, now, `restore of gen ${generation}`);
  if (!result.ok) {
    return { ok: false, status: result.status === 404 ? 404 : 400, title: result.title, detail: result.detail };
  }
  return result;
}

/**
 * POST …/reconcile?dryRun=true. A draft body plans the next generation; no
 * body plans the current desired state. Pure: nothing is written.
 */
export async function planSpec(slug: string, draftBody: string | undefined, now: Date): Promise<Plan | null> {
  const [state, tenant] = await Promise.all([stateFor(slug), getTenant(slug)]);
  if (!state || !tenant) return null;
  const generation = draftBody === undefined ? state.currentGeneration : state.currentGeneration + 1;
  return PlanSchema.parse(planFixture(slug, tenant.displayName, generation, now));
}

/**
 * POST …/reconcile → 202 { runId }. Until the API exists this re-enqueues the
 * tenant's latest settled run through the reconcile feature's own retry path,
 * so the run detail page has something real to show; a tenant with no settled
 * run gets a deterministic synthetic id.
 */
export async function enqueueReconcile(slug: string, idempotencyKey: string, now: Date): Promise<ReconcileAccepted> {
  const page = await listRuns(RunListFilterSchema.parse({ tenant: slug, limit: 10 }));
  const settled = page.items.find((r) => r.finishedAt !== null);
  if (settled) {
    const r = await retryRun(settled.id, idempotencyKey);
    if (r.ok) return ReconcileAcceptedSchema.parse({ runId: r.runId });
  }
  const runId = `${fnv1a(`${slug}:${idempotencyKey}`)}${fnv1a(now.toISOString()).slice(0, 4)}`;
  return ReconcileAcceptedSchema.parse({ runId });
}

export async function reconcileNow(slug: string, idempotencyKey: string, now: Date): Promise<ReconcileAccepted | null> {
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  return enqueueReconcile(slug, idempotencyKey, now);
}
