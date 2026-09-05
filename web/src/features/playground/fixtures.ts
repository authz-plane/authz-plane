import { TENANTS, tenantDetailFixture } from "@/features/tenants/fixtures";
import { relationsOf, type AuthorizationModel, type StoredTuple } from "./resolver";
import type { CheckTuple, PlaygroundTenant } from "./schemas";

/**
 * Fixture model + tuple set for the playground. acme-air's v6 model produces
 * exactly the §9.1 tree for `user:raj viewer document:budget-2026`: the direct
 * branch and the computed `editor` branch fail, the `parent` tuple-to-userset
 * succeeds through the editor tuple on folder:finance, which is the decisive
 * tuple. Five nodes, depth three.
 */
export const ACME_AIR_MODEL_V6: AuthorizationModel = {
  user: {},
  folder: {
    owner: { direct: true },
    editor: { direct: true },
    viewer: { direct: true, computed: ["editor"] },
    auditor: { direct: true },
  },
  document: {
    parent: { direct: true },
    owner: { direct: true },
    editor: { direct: true },
    viewer: { direct: true, computed: ["editor"], tupleToUserset: [{ tupleset: "parent", relation: "editor" }] },
    auditor: { direct: true, tupleToUserset: [{ tupleset: "parent", relation: "auditor" }] },
  },
};

/** Smaller model every other fixture tenant shares. */
export const DEFAULT_MODEL: AuthorizationModel = {
  user: {},
  folder: {
    owner: { direct: true },
    editor: { direct: true, computed: ["owner"] },
    viewer: { direct: true, computed: ["editor"] },
  },
  document: {
    parent: { direct: true },
    owner: { direct: true },
    editor: { direct: true, computed: ["owner"] },
    viewer: { direct: true, computed: ["editor"], tupleToUserset: [{ tupleset: "parent", relation: "viewer" }] },
  },
};

/** Audit event ids link to /tenants/{slug}/audit-events?event={id}. All actors are synthetic. */
export const ACME_AIR_TUPLES: StoredTuple[] = [
  {
    object: "folder:finance",
    relation: "editor",
    user: "user:raj",
    tupleId: "a3f1d2e4b6c9",
    writtenAt: "2026-08-30T09:00:00Z",
    writtenBy: "admin@acme.test",
    auditEventId: "evt_tuple_a3f1",
  },
  {
    object: "document:budget-2026",
    relation: "parent",
    user: "folder:finance",
    tupleId: "b81e7c0a5d43",
    writtenAt: "2026-08-30T09:00:00Z",
    writtenBy: "system:reconciler",
    auditEventId: "evt_tuple_b81e",
  },
  {
    object: "document:budget-2026",
    relation: "viewer",
    user: "user:ana",
    tupleId: "c27d9f1e3b85",
    writtenAt: "2026-09-01T14:22:00Z",
    writtenBy: "admin@acme.test",
    auditEventId: "evt_tuple_c27d",
  },
  {
    object: "folder:finance",
    relation: "owner",
    user: "user:lee",
    tupleId: "d4a06b2c8e17",
    writtenAt: "2026-08-12T08:05:00Z",
    writtenBy: "system:reconciler",
    auditEventId: "evt_tuple_d4a0",
  },
];

export const TUPLES_BY_TENANT: Record<string, StoredTuple[]> = {
  "acme-air": ACME_AIR_TUPLES,
};

export function modelFor(slug: string): AuthorizationModel {
  return slug === "acme-air" ? ACME_AIR_MODEL_V6 : DEFAULT_MODEL;
}

export function tuplesFor(slug: string): StoredTuple[] {
  return TUPLES_BY_TENANT[slug] ?? [];
}

/** Tenant options for the TENANT select, consistent with features/tenants. */
export function playgroundTenants(): PlaygroundTenant[] {
  return TENANTS.map((t) => ({
    slug: t.slug,
    displayName: t.displayName,
    modelVersion: tenantDetailFixture(t.slug)?.modelVersion ?? 0,
    relations: relationsOf(modelFor(t.slug)),
  }));
}

/** The frame's query: the one the page pre-runs on first load. */
export const DEFAULT_QUERY: CheckTuple & { slug: string } = {
  slug: "acme-air",
  user: "user:raj",
  relation: "viewer",
  object: "document:budget-2026",
};

/** Sample the textarea shows when batch mode is switched on. */
export const BATCH_PLACEHOLDER = ["user:raj viewer document:budget-2026", "user:ana editor document:budget-2026", "user:lee owner folder:finance"].join(
  "\n",
);
