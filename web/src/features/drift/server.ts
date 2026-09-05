import "server-only";

import { driftFixtures, HEALED_TODAY_BASELINE, LAST_RESYNC_MINUTES_AGO } from "./fixtures";
import {
  DriftFindingSchema,
  DriftListSchema,
  HealResponseSchema,
  ResyncResponseSchema,
  type DriftFinding,
  type DriftList,
  type DriftListFilter,
  type HealResponse,
  type ResyncResponse,
} from "./schemas";

/**
 * Server-side drift access. Pages and the /api/drift route handlers both call
 * these so the hydrated cache and the client refetch agree.
 *
 * Until AuthzPlane.Api exposes GET /v1/drift, findings live in an in-memory
 * store seeded from fixtures on first use. Heal and acknowledge mutate that
 * store so the UI reacts; it resets whenever the server process restarts.
 */

interface Store {
  findings: Map<string, DriftFinding>;
  healedToday: number;
  lastResyncAt: string;
}

let store: Store | null = null;

function ensureStore(now = new Date()): Store {
  if (!store) {
    store = {
      findings: new Map(driftFixtures(now).map((f) => [f.id, f])),
      healedToday: HEALED_TODAY_BASELINE,
      lastResyncAt: new Date(now.getTime() - LAST_RESYNC_MINUTES_AGO * 60_000).toISOString(),
    };
  }
  return store;
}

/** Test hook: drop the in-memory store so the next call reseeds from fixtures at `now`. */
export function resetDriftStore(now?: Date): void {
  store = null;
  if (now) ensureStore(now);
}

const SEVERITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function openFindings(s: Store, tenant?: string): DriftFinding[] {
  return [...s.findings.values()]
    .filter((f) => f.status === "open" && (!tenant || f.tenant === tenant))
    .sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        Date.parse(b.detectedAt) - Date.parse(a.detectedAt) ||
        a.id.localeCompare(b.id),
    );
}

export async function listDrift(filter: DriftListFilter, now = new Date()): Promise<DriftList> {
  const s = ensureStore(now);
  // Stats describe the scope (platform, or the one tenant), not the severity filter.
  const scope = openFindings(s, filter.tenant);
  const items = filter.severity ? scope.filter((f) => f.severity === filter.severity) : scope;
  const oldest = scope.reduce<number | null>((acc, f) => {
    const age = Math.floor((now.getTime() - Date.parse(f.detectedAt)) / 1000);
    return acc === null || age > acc ? age : acc;
  }, null);
  return DriftListSchema.parse({
    generatedAt: now.toISOString(),
    items,
    stats: {
      open: scope.length,
      tenantsAffected: new Set(scope.map((f) => f.tenant)).size,
      oldestUnresolvedSeconds: oldest,
      healedToday: s.healedToday,
    },
    lastResyncAt: s.lastResyncAt,
    resyncIntervalSeconds: 600,
    tenants: [...new Set(openFindings(s).map((f) => f.tenant))].sort(),
  });
}

export async function getDriftFinding(id: string): Promise<DriftFinding | null> {
  const f = ensureStore().findings.get(id);
  return f ? DriftFindingSchema.parse(f) : null;
}

function newRunId(): string {
  return crypto.randomUUID().replaceAll("-", "").slice(0, 12);
}

/**
 * Bulk heal: one reconcile per affected tenant (handoff "Mutations"). Findings
 * leave the open set immediately in the fixture store; the real API closes
 * them on convergence. Unknown ids are ignored so a stale selection is not an
 * error.
 */
export async function healFindings(findingIds: string[]): Promise<HealResponse> {
  const s = ensureStore();
  const tenants = new Map<string, string>();
  for (const id of findingIds) {
    const f = s.findings.get(id);
    if (!f || f.status !== "open") continue;
    const runId = tenants.get(f.tenant) ?? newRunId();
    tenants.set(f.tenant, runId);
    s.findings.delete(id);
    s.healedToday += 1;
  }
  return HealResponseSchema.parse({
    runs: [...tenants.entries()].map(([tenant, runId]) => ({ tenant, runId })),
  });
}

/** Acknowledge as accepted: suppresses this exact field path; the finding stays addressable. */
export async function acknowledgeFinding(id: string): Promise<DriftFinding | null> {
  const s = ensureStore();
  const f = s.findings.get(id);
  if (!f) return null;
  const next: DriftFinding = { ...f, status: "acknowledged" };
  s.findings.set(id, next);
  return DriftFindingSchema.parse(next);
}

/** Resync all: the real API enqueues a fleet-wide resync and answers 202. */
export async function resyncAll(now = new Date()): Promise<ResyncResponse> {
  const s = ensureStore(now);
  s.lastResyncAt = now.toISOString();
  return ResyncResponseSchema.parse({ status: "accepted", scheduledAt: now.toISOString() });
}
