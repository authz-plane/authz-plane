import "server-only";

import { getTenant } from "@/features/tenants/server";
import { parseModel, summarize } from "./dsl";
import {
  ACME_CACHED_DECISIONS,
  ACME_DRAFT_DSL_V7,
  ACME_LIVE_DSL_V6,
  ACME_VERSIONS,
  GENERIC_DSL,
  genericVersions,
} from "./fixtures";
import {
  AuthorizationModelSchema,
  StageResultSchema,
  ValidationResultSchema,
  type AuthorizationModel,
  type StageResult,
  type ValidationResult,
} from "./schemas";

/**
 * Server-side access to a tenant's authorization model. Pages and the
 * /api/tenants/[slug]/authorization-model route handlers call these. Fixtures
 * until AuthzPlane.Api exposes the model endpoints.
 *
 * Staged drafts live in a module-level Map so the UI reacts to "Stage into
 * spec"; the store resets whenever the server process restarts.
 */

type Failure = { ok: false; status: number; title: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

interface ModelState {
  live: string;
  draft: string;
  liveVersion: number;
  draftVersion: number | null;
  versions: AuthorizationModel["versions"];
  cachedDecisions: number;
}

const store = new Map<string, ModelState>();

async function stateFor(slug: string): Promise<ModelState | null> {
  const cached = store.get(slug);
  if (cached) return cached;
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const state: ModelState =
    slug === "acme-air"
      ? {
          live: ACME_LIVE_DSL_V6,
          draft: ACME_DRAFT_DSL_V7,
          liveVersion: 6,
          draftVersion: 7,
          versions: ACME_VERSIONS,
          cachedDecisions: ACME_CACHED_DECISIONS,
        }
      : {
          live: GENERIC_DSL,
          draft: GENERIC_DSL,
          liveVersion: Math.max(1, tenant.modelVersion),
          draftVersion: null,
          versions: genericVersions(Math.max(1, tenant.modelVersion)),
          cachedDecisions: 12,
        };
  store.set(slug, state);
  return state;
}

export async function getAuthorizationModel(slug: string): Promise<AuthorizationModel | null> {
  const [state, tenant] = await Promise.all([stateFor(slug), getTenant(slug)]);
  if (!state || !tenant) return null;
  return AuthorizationModelSchema.parse({
    slug,
    liveVersion: state.liveVersion,
    draftVersion: state.draftVersion,
    live: state.live,
    draft: state.draft,
    versions: state.versions,
    tupleCount: tenant.tupleCount,
    cachedDecisions: state.cachedDecisions,
  });
}

/** Fixture parser: counts types/relations/depth and reports unknown references. */
export async function validateModel(slug: string, dsl: string): Promise<Result<ValidationResult>> {
  const tenant = await getTenant(slug);
  if (!tenant) return { ok: false, status: 404, title: "Tenant not found" };
  const parsed = parseModel(dsl);
  const summary = summarize(parsed);
  // Deterministic "latency": proportional to input so repeated runs agree.
  const elapsedMs = 20 + Math.min(40, Math.floor(dsl.length / 40));
  return {
    ok: true,
    data: ValidationResultSchema.parse({
      ok: parsed.issues.length === 0,
      types: summary.types,
      relations: summary.relations,
      depth: summary.depth,
      issues: parsed.issues,
      tuplesValidated: parsed.issues.length === 0 ? tenant.tupleCount : 0,
      elapsedMs,
    }),
  };
}

/**
 * Stage the draft DSL into the next spec generation. Does not write to
 * OpenFGA: the reconciler applies the model when the generation converges.
 */
export async function stageModel(slug: string, dsl: string, now: Date): Promise<Result<StageResult>> {
  const [state, tenant] = await Promise.all([stateFor(slug), getTenant(slug)]);
  if (!state || !tenant) return { ok: false, status: 404, title: "Tenant not found" };
  const parsed = parseModel(dsl);
  if (parsed.issues.length > 0) {
    const first = parsed.issues[0]!;
    return {
      ok: false,
      status: 400,
      title: "Model does not parse",
      detail: `line ${first.line}: ${first.message}${parsed.issues.length > 1 ? ` (+${parsed.issues.length - 1} more)` : ""}`,
    };
  }
  const version = state.draftVersion ?? state.liveVersion + 1;
  state.draft = dsl;
  state.draftVersion = version;
  const stagedAt = now.toISOString();
  const existing = state.versions.find((v) => v.version === version);
  const entry = {
    version,
    author: "raj.kolekar",
    createdAt: stagedAt,
    summary: `staged into generation ${tenant.generation + 1}`,
    state: "draft" as const,
  };
  state.versions = existing
    ? state.versions.map((v) => (v.version === version ? { ...v, ...entry } : v))
    : [...state.versions, entry];
  return {
    ok: true,
    data: StageResultSchema.parse({ generation: tenant.generation + 1, version, stagedAt }),
  };
}

/** Test hook: forget staged drafts. */
export function resetAuthzModelStore(): void {
  store.clear();
}
