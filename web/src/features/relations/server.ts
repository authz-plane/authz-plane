import "server-only";

import { parseModel } from "@/features/authz-model/dsl";
import { ACME_LIVE_DSL_V6, GENERIC_DSL } from "@/features/authz-model/fixtures";
import { getTenant } from "@/features/tenants/server";
import { tupleKey, sameTuple } from "./format";
import { ACME_TUPLE_TOTAL, CACHED_DECISIONS, DEFAULT_CACHED_DECISIONS, acmeTuples, genericTuples } from "./fixtures";
import {
  PAGE_SIZE,
  RelationsPageSchema,
  WriteResultSchema,
  type RelationsFilter,
  type RelationsPage,
  type Tuple,
  type WriteRequest,
  type WriteResult,
} from "./schemas";

/**
 * Server-side tuple access. Pages and /api/tenants/[slug]/relations handlers
 * share these. Fixtures until AuthzPlane.Api exposes GET /relations and
 * POST /relations:write.
 *
 * Writes mutate a module-level Map so the browser sees its own changes after
 * the refetch; the store resets whenever the server process restarts.
 */

type Failure = { ok: false; status: number; title: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

interface Store {
  items: Tuple[];
  /** the total the real index would report; the fixture materialises far fewer rows */
  total: number;
  seq: number;
  modelDsl: string;
  modelVersion: number;
  cachedDecisions: number;
}

const stores = new Map<string, Store>();

async function storeFor(slug: string): Promise<Store | null> {
  const cached = stores.get(slug);
  if (cached) return cached;
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const store: Store =
    slug === "acme-air"
      ? {
          items: acmeTuples(),
          total: ACME_TUPLE_TOTAL,
          seq: 13,
          modelDsl: ACME_LIVE_DSL_V6,
          modelVersion: tenant.modelVersion,
          cachedDecisions: CACHED_DECISIONS[slug] ?? DEFAULT_CACHED_DECISIONS,
        }
      : {
          items: genericTuples(slug, tenant.observedGeneration || tenant.generation),
          total: tenant.tupleCount,
          seq: 5,
          modelDsl: GENERIC_DSL,
          modelVersion: Math.max(1, tenant.modelVersion),
          cachedDecisions: CACHED_DECISIONS[slug] ?? DEFAULT_CACHED_DECISIONS,
        };
  stores.set(slug, store);
  return store;
}

/** Exact match, or prefix when the pattern ends in `*` (e.g. `folder:*`). */
function matches(value: string, pattern: string | undefined): boolean {
  if (!pattern) return true;
  return pattern.endsWith("*") ? value.startsWith(pattern.slice(0, -1)) : value === pattern;
}

const CURSOR = /^c(\d+)$/;

export async function listRelations(
  slug: string,
  filter: RelationsFilter,
  cursor: string | undefined,
  limit: number = PAGE_SIZE,
): Promise<RelationsPage | null> {
  const store = await storeFor(slug);
  if (!store) return null;
  const filtered = store.items.filter(
    (t) => matches(t.user, filter.user) && matches(t.relation, filter.relation) && matches(t.object, filter.object),
  );
  const offset = cursor ? Number(CURSOR.exec(cursor)?.[1] ?? 0) : 0;
  const items = filtered.slice(offset, offset + limit);
  const end = offset + items.length;
  const hasFilter = Boolean(filter.user || filter.relation || filter.object);
  return RelationsPageSchema.parse({
    items,
    nextCursor: end < filtered.length ? `c${end}` : null,
    total: hasFilter ? filtered.length : store.total,
    modelVersion: store.modelVersion,
    cachedDecisions: store.cachedDecisions,
  });
}

/**
 * Atomic batch: every write and delete is validated first; nothing is applied
 * if any fails. Writes are checked against the tenant's live model only.
 */
export async function writeRelations(slug: string, req: WriteRequest, now: Date): Promise<Result<WriteResult>> {
  const store = await storeFor(slug);
  if (!store) return { ok: false, status: 404, title: "Tenant not found" };

  for (const t of [...req.writes, ...req.deletes]) {
    if (t.object.startsWith("platform:") || t.user.startsWith("platform:")) {
      return {
        ok: false,
        status: 400,
        title: "Reserved namespace",
        detail: `platform:* is reserved for the control plane · ${tupleKey(t)} rejected`,
      };
    }
  }

  const model = parseModel(store.modelDsl);
  for (const w of req.writes) {
    const typeName = w.object.split(":")[0]!;
    const type = model.types.find((t) => t.name === typeName);
    if (!type || !type.relations.some((r) => r.name === w.relation)) {
      return {
        ok: false,
        status: 400,
        title: "Relation not in model",
        detail: `${w.relation} is not defined on ${typeName} in model v${store.modelVersion} · ${tupleKey(w)} rejected`,
      };
    }
  }

  let deleted = 0;
  store.items = store.items.filter((existing) => {
    const hit = req.deletes.some((d) => sameTuple(d, existing));
    if (hit) deleted += 1;
    return !hit;
  });

  let written = 0;
  for (const w of req.writes) {
    if (store.items.some((existing) => sameTuple(existing, w))) continue; // idempotent
    store.items.push({
      id: `t-${String(store.seq++).padStart(4, "0")}`,
      ...w,
      source: { kind: "api" },
      writtenAt: now.toISOString(),
    });
    written += 1;
  }
  store.total += written - deleted;

  return {
    ok: true,
    data: WriteResultSchema.parse({
      written,
      deleted,
      invalidatedDecisions: store.cachedDecisions,
      modelVersion: store.modelVersion,
    }),
  };
}

/** Test hook: forget every write. */
export function resetRelationsStore(): void {
  stores.clear();
}
