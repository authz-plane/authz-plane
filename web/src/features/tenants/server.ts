import "server-only";

import {
  FLEET_BY_PHASE,
  FLEET_TOTAL,
  FLEET_WITH_DRIFT,
  TENANTS,
  tenantDetailFor,
} from "./fixtures";
import {
  CreateTenantInputSchema,
  TenantDetailSchema,
  TenantPageSchema,
  TenantSummarySchema,
  type CreateTenantInput,
  type Phase,
  type TenantDetail,
  type TenantListFilter,
  type TenantPage,
  type TenantSummary,
} from "./schemas";
import { validateSlug } from "./slug";
import { specYaml, starterRoles, STARTER_MODEL_LABELS } from "./spec-preview";

/**
 * Server-side tenant access. Pages call these directly; route handlers under
 * /api/tenants call the same functions so both paths agree. Fixtures until
 * AuthzPlane.Api exposes GET/POST /v1/tenants and GET /v1/tenants/{id}.
 *
 * Tenants created through the console live in an in-memory store so the UI
 * reacts (they appear in the list, /tenants/{slug} resolves). The store is
 * process-local and resets on restart; it hangs off globalThis because the
 * dev server may load this module once per route bundle.
 */

interface CreatedTenant {
  summary: TenantSummary;
  input: CreateTenantInput;
}

const STORE_KEY = Symbol.for("authz-plane.tenants.created");

function createdStore(): Map<string, CreatedTenant> {
  const g = globalThis as unknown as Record<symbol, Map<string, CreatedTenant> | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

function allTenants(): TenantSummary[] {
  // Newest console-created tenants first, then the canonical fixtures in their fixed order.
  const created = [...createdStore().values()].map((c) => c.summary).reverse();
  return [...created, ...TENANTS];
}

function findAny(slug: string): TenantSummary | undefined {
  return allTenants().find((t) => t.slug === slug);
}

export async function listTenants(filter: TenantListFilter): Promise<TenantPage> {
  const fleet = allTenants();
  let items = fleet;
  if (filter.phase) items = items.filter((t) => t.phase === filter.phase);
  if (filter.hasDrift) items = items.filter((t) => t.openDrift > 0);
  if (filter.q) {
    const q = filter.q.toLowerCase();
    items = items.filter(
      (t) =>
        t.slug.includes(q) ||
        t.displayName.toLowerCase().includes(q) ||
        (t.orgId ?? "").includes(q),
    );
  }

  // Cursor = slug of the last row on the previous page. Unknown cursor → first page.
  const start = filter.cursor ? items.findIndex((t) => t.slug === filter.cursor) + 1 : 0;
  const page = items.slice(start, start + filter.limit);
  const nextCursor = start + filter.limit < items.length ? (page.at(-1)?.slug ?? null) : null;

  const createdCount = createdStore().size;
  const filtered = Boolean(filter.phase || filter.hasDrift || filter.q);
  const byPhase: Record<Phase, number> = { ...FLEET_BY_PHASE };
  for (const c of createdStore().values()) byPhase[c.summary.phase] += 1;

  return TenantPageSchema.parse({
    items: page,
    nextCursor,
    total: filtered ? items.length : FLEET_TOTAL + createdCount,
    counts: {
      all: FLEET_TOTAL + createdCount,
      byPhase,
      withDrift: FLEET_WITH_DRIFT,
    },
  });
}

export async function getTenant(slug: string): Promise<TenantDetail | null> {
  const created = createdStore().get(slug);
  if (created) return TenantDetailSchema.parse(pendingDetail(created));
  const summary = TENANTS.find((t) => t.slug === slug);
  return summary ? TenantDetailSchema.parse(tenantDetailFor(summary)) : null;
}

/** Slug availability for the form's async check. Well-formed and not held by any tenant. */
export async function isSlugAvailable(slug: string): Promise<{ available: boolean; reason?: string }> {
  const invalid = validateSlug(slug);
  if (invalid) return { available: false, reason: invalid };
  if (findAny(slug)) return { available: false, reason: "taken" };
  return { available: true };
}

/** 409-shaped error the route handler turns into problem+json. */
export class SlugTakenError extends Error {
  readonly status = 409;
  readonly title = "Slug already taken";
  constructor(slug: string) {
    super(`A tenant with slug "${slug}" already exists. Slugs are immutable, pick another.`);
    this.name = "SlugTakenError";
  }
}

/**
 * Create a tenant at generation 1 in phase Pending. The reconciler (not this
 * call) creates the Zitadel org, so orgId stays null and nothing has been
 * reconciled yet.
 */
export async function createTenant(
  raw: CreateTenantInput,
  now: Date = new Date(),
): Promise<TenantSummary> {
  const input = CreateTenantInputSchema.parse(raw);
  if (findAny(input.slug)) throw new SlugTakenError(input.slug);

  const summary = TenantSummarySchema.parse({
    id: fnv1a(`tenant:${input.slug}`).slice(0, 6),
    slug: input.slug,
    displayName: input.displayName,
    phase: "Pending",
    generation: 1,
    observedGeneration: 0,
    openDrift: 0,
    lastReconciledAt: null,
    idp: null,
    autoHeal: input.autoHeal,
    resyncIntervalSeconds: input.resyncIntervalSeconds,
    createdAt: now.toISOString(),
    orgId: null,
    specHash: fnv1a(specYaml(input)),
  });
  createdStore().set(input.slug, { summary, input });
  return summary;
}

/** Tests only: forget console-created tenants. */
export function resetCreatedTenantsForTests(): void {
  createdStore().clear();
}

function pendingDetail({ summary, input }: CreatedTenant): TenantDetail {
  return {
    ...summary,
    lastError: null,
    observedLagSeconds: 0,
    tupleCount: 0,
    modelVersion: 0,
    desired: {
      identityProviders: [],
      modelSummary: `v1 staged · ${STARTER_MODEL_LABELS[input.starterModel].title.toLowerCase()}`,
      roles: starterRoles(input.starterModel),
      userCount: 0,
      policy: `auto-heal ${input.autoHeal ? "on" : "off"} · resync ${input.resyncIntervalSeconds}s`,
    },
  };
}

/** 32-bit FNV-1a as 8 hex chars. Deterministic ids for fixture-created rows. */
function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
