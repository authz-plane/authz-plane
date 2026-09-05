import type { Actor, AuditEvent } from "./schemas";

/**
 * Audit stream fixtures, consistent with the rest of the console's story:
 * acme-air's spec went to generation 9 at 10:14:22Z, run 8f1c degraded five
 * seconds later, its two drift findings were detected by resync run 71a0,
 * and globex's four findings by run a7d3 at 10:08:41Z. All actors are
 * synthetic. Times are absolute (fixture "now" is 2026-09-04T10:15:00Z), so
 * the stream reads the same on every render.
 */

const HUMAN_OPS: Actor = { id: "ops@acme-air.test", kind: "human", label: "ops@acme-air.test" };
const HUMAN_ADMIN: Actor = { id: "admin@acme-air.test", kind: "human", label: "admin@acme-air.test" };
const RECONCILER: Actor = { id: "system:reconciler", kind: "system", label: "system:reconciler" };
const CI_BOT: Actor = { id: "ci-bot", kind: "m2m", label: "ci-bot (m2m)" };
const INITECH_OPS: Actor = { id: "ops@initech-labs.test", kind: "human", label: "ops@initech-labs.test" };

/** Same request as run 8f1c's trace, so the run detail and the audit rows agree. */
const ACME_GEN9_REQUEST = "4bf9e2c7d81a03b6f5a1";
const ACME_RESYNC_REQUEST = "71a0c3d9e5f2b84d10c3";
const GLOBEX_RESYNC_REQUEST = "a7d30f5c81e9427bd60c";

const D = "2026-09-04T";

type Seed = Omit<AuditEvent, "traceId" | "ip" | "idempotencyKey" | "specHash" | "relatedRunId"> &
  Partial<Pick<AuditEvent, "traceId" | "ip" | "idempotencyKey" | "specHash" | "relatedRunId">>;

function event(seed: Seed): AuditEvent {
  return {
    traceId: null,
    ip: null,
    idempotencyKey: null,
    specHash: null,
    relatedRunId: null,
    ...seed,
  };
}

/** Newest first, as the (tenant_id, occurred_at DESC) index returns them. */
export const AUDIT_EVENTS: AuditEvent[] = [
  event({
    id: "evt_01k4a9x2m8",
    tenant: "acme-air",
    occurredAt: `${D}10:14:27.902Z`,
    actor: RECONCILER,
    action: "ReconcileDegraded",
    resource: "run 8f1c · change 4",
    title: "run 8f1c9e4b27d2 → Degraded at change 4",
    requestId: ACME_GEN9_REQUEST,
    traceId: ACME_GEN9_REQUEST,
    diff: [
      { kind: "removed", text: "outcome: Applying · 3/5 applied" },
      { kind: "added", text: "outcome: Partial · change 4 failed" },
      { kind: "removed", text: "lastError: null" },
      { kind: "added", text: "lastError: OpenFGA WriteTuples timed out after 3000ms" },
    ],
    relatedRunId: "8f1c9e4b27d2",
  }),
  event({
    id: "evt_01k4a9wz7q",
    tenant: "acme-air",
    occurredAt: `${D}10:14:22.481Z`,
    actor: HUMAN_OPS,
    action: "SpecUpdated",
    resource: "tenant:acme-air gen 9",
    title: "tenant:acme-air → generation 9",
    requestId: ACME_GEN9_REQUEST,
    traceId: ACME_GEN9_REQUEST,
    ip: "82.14.x.x",
    idempotencyKey: "0e1f7a3c-5d2b-4e8f-9a01-c6d4b2e7f19b",
    specHash: "b7e21f04",
    diff: [
      { kind: "removed", text: "roles: [tenant_admin, tenant_viewer]" },
      { kind: "added", text: "roles: [tenant_admin, tenant_viewer, tenant_auditor]" },
      { kind: "removed", text: "relations: 5 entries" },
      { kind: "added", text: "relations: 4 entries" },
    ],
    relatedRunId: "8f1c9e4b27d2",
  }),
  event({
    id: "evt_01k4a9d4rt",
    tenant: "acme-air",
    occurredAt: `${D}09:53:00.117Z`,
    actor: RECONCILER,
    action: "DriftDetected",
    resource: "zitadel.org displayName",
    title: "drift · zitadel.org displayName changed out-of-band",
    requestId: ACME_RESYNC_REQUEST,
    traceId: ACME_RESYNC_REQUEST,
    diff: [
      { kind: "removed", text: 'displayName: "Acme Airways"' },
      { kind: "added", text: 'displayName: "Acme Air (test)"' },
      { kind: "context", text: "finding 3a6f2d91 · medium · no matching audit event" },
    ],
    relatedRunId: "71a0c3d9e5f2",
  }),
  event({
    id: "evt_01k4a9cq0v",
    tenant: "acme-air",
    occurredAt: `${D}09:52:10.664Z`,
    actor: CI_BOT,
    action: "RelationsWritten",
    resource: "3 writes · 1 delete",
    title: "relations:write → 3 writes · 1 delete",
    requestId: "e112f9c4a07b3d58e27b",
    traceId: "e112f9c4a07b3d58e27b",
    ip: "10.40.x.x",
    idempotencyKey: "9b3d21e0-7f4a-4c6b-8d15-2a0e5f7c4d7b",
    diff: [
      { kind: "removed", text: "folder:finance#viewer@user:omar" },
      { kind: "added", text: "folder:finance#editor@user:dana" },
      { kind: "added", text: "folder:ops#viewer@user:mira" },
      { kind: "added", text: "document:budget-2026#viewer@group:finance#member" },
    ],
  }),
  event({
    id: "evt_01k4a97h2e",
    tenant: "acme-air",
    occurredAt: `${D}09:41:03.208Z`,
    actor: HUMAN_ADMIN,
    action: "CheckExplained",
    resource: "document:budget-2026#viewer",
    title: "explain user:dana viewer document:budget-2026 → allowed",
    requestId: "77aa4e1c9d02b5f3862e",
    traceId: "77aa4e1c9d02b5f3862e",
    ip: "82.14.x.x",
    diff: [
      { kind: "context", text: "allowed · 2 hops · consistency=strong" },
      { kind: "context", text: "document:budget-2026#viewer ← folder:finance#editor" },
      { kind: "context", text: "folder:finance#editor ← user:dana" },
    ],
  }),
  event({
    id: "evt_01k4a8tz5k",
    tenant: "acme-air",
    occurredAt: `${D}09:15:04.330Z`,
    actor: RECONCILER,
    action: "DriftDetected",
    resource: "fga.model document#viewer",
    title: "drift · authorization model behind desired version",
    requestId: ACME_RESYNC_REQUEST,
    traceId: ACME_RESYNC_REQUEST,
    diff: [
      { kind: "removed", text: "authorizationModel: v7 (staged in generation 9)" },
      { kind: "added", text: "authorizationModel: v6" },
      { kind: "context", text: "finding c8e15b70 · medium" },
    ],
    relatedRunId: "71a0c3d9e5f2",
  }),
  event({
    id: "evt_01k4a8f0a1",
    tenant: "acme-air",
    occurredAt: `${D}09:00:00.012Z`,
    actor: HUMAN_ADMIN,
    action: "TupleWritten",
    resource: "folder:finance#editor@user:dana",
    title: "tuple written · folder:finance#editor@user:dana",
    requestId: "a3f1d8b27c40e95f61c9",
    traceId: "a3f1d8b27c40e95f61c9",
    ip: "82.14.x.x",
    idempotencyKey: "4c7e90a2-1b3d-4f58-a6e1-0d2c8b5f3e91",
    diff: [{ kind: "added", text: "folder:finance#editor@user:dana" }],
  }),
  event({
    id: "evt_01k4a7x9nd",
    tenant: "acme-air",
    occurredAt: `${D}08:31:55.771Z`,
    actor: HUMAN_OPS,
    action: "IdpSecretRotated",
    resource: "idp:acme-entra",
    title: "idp:acme-entra client secret rotated",
    requestId: "b904c7e2f31a5d086af3",
    traceId: "b904c7e2f31a5d086af3",
    ip: "82.14.x.x",
    idempotencyKey: "7d2f4b19-e0c3-4a87-b5d6-91e3a0f7c2d4",
    diff: [
      { kind: "removed", text: "clientSecret: [redacted] · set 2026-06-14" },
      { kind: "added", text: "clientSecret: [redacted] · rotated" },
    ],
  }),
  event({
    id: "evt_01k4a7d2q8",
    tenant: "acme-air",
    occurredAt: `${D}08:10:12.540Z`,
    actor: RECONCILER,
    action: "ReconcileSucceeded",
    resource: "run 71a0 · resync",
    title: "run 71a0c3d9e5f2 → NoChanges",
    requestId: ACME_RESYNC_REQUEST,
    traceId: ACME_RESYNC_REQUEST,
    diff: [{ kind: "context", text: "resync · 0 changes · 312 users mirrored" }],
    relatedRunId: "71a0c3d9e5f2",
  }),
  event({
    id: "evt_01k4a6y7wb",
    tenant: "acme-air",
    occurredAt: `${D}07:45:36.290Z`,
    actor: RECONCILER,
    action: "ReconcileSucceeded",
    resource: "run 3d7e · gen 8",
    title: "run 3d7e0b91c4a2 → Succeeded · generation 8 observed",
    requestId: "3d7e0b91c4a2f6d8e5b0",
    traceId: "3d7e0b91c4a2f6d8e5b0",
    diff: [
      { kind: "removed", text: "observedGeneration: 7" },
      { kind: "added", text: "observedGeneration: 8" },
    ],
    relatedRunId: "3d7e0b91c4a2",
  }),
  event({
    id: "evt_01k4a6y2hs",
    tenant: "acme-air",
    occurredAt: `${D}07:45:31.006Z`,
    actor: HUMAN_OPS,
    action: "SpecUpdated",
    resource: "tenant:acme-air gen 8",
    title: "tenant:acme-air → generation 8",
    requestId: "3d7e0b91c4a2f6d8e5b0",
    traceId: "3d7e0b91c4a2f6d8e5b0",
    ip: "82.14.x.x",
    idempotencyKey: "2a9c1e47-6b0d-4f3e-8c52-d7e1b4a0f963",
    specHash: "9c40d2a7",
    diff: [
      { kind: "removed", text: "identityProviders: [acme-entra]" },
      { kind: "added", text: "identityProviders: [acme-entra, acme-legacy-saml (disabled)]" },
    ],
    relatedRunId: "3d7e0b91c4a2",
  }),
  event({
    id: "evt_01k4a5m1zx",
    tenant: "acme-air",
    occurredAt: `${D}06:30:00.442Z`,
    actor: CI_BOT,
    action: "RelationsWritten",
    resource: "12 writes · 0 deletes",
    title: "relations:write → 12 writes · 0 deletes",
    requestId: "c58a2d7f90e14b3c6d02",
    traceId: "c58a2d7f90e14b3c6d02",
    ip: "10.40.x.x",
    idempotencyKey: "e3b0c442-98fc-4c14-9afb-f4c8996fb924",
    diff: [
      { kind: "added", text: "folder:ops#editor@group:sre#member" },
      { kind: "added", text: "folder:ops#viewer@group:eng#member" },
      { kind: "context", text: "+10 more writes" },
    ],
  }),
  event({
    id: "evt_01k4a5b8pc",
    tenant: "acme-air",
    occurredAt: `${D}06:02:19.873Z`,
    actor: HUMAN_ADMIN,
    action: "CheckExplained",
    resource: "folder:ops#viewer",
    title: "explain user:omar viewer folder:ops → denied",
    requestId: "f0d3a91e7c25b48d6a11",
    traceId: "f0d3a91e7c25b48d6a11",
    ip: "82.14.x.x",
    diff: [
      { kind: "context", text: "denied · 0 paths · consistency=eventual" },
      { kind: "context", text: "folder:ops#viewer has no path to user:omar" },
    ],
  }),
  event({
    id: "evt_01k4a4z6tr",
    tenant: "acme-air",
    occurredAt: `${D}05:40:08.115Z`,
    actor: HUMAN_OPS,
    action: "DriftAcknowledged",
    resource: "zitadel.user count",
    title: "drift acknowledged · zitadel.user count",
    requestId: "d61b8f4a2e07c93d5f0e",
    traceId: "d61b8f4a2e07c93d5f0e",
    ip: "82.14.x.x",
    idempotencyKey: "51ac3e7d-0f2b-4d96-a8c4-3b7e9d1f0a25",
    diff: [
      { kind: "removed", text: "status: open" },
      { kind: "added", text: "status: acknowledged · suppressed until desired changes" },
    ],
  }),

  // Other tenants (platform view only)
  event({
    id: "evt_01k4a9mq3w",
    tenant: "initech-labs",
    occurredAt: `${D}10:12:00.338Z`,
    actor: INITECH_OPS,
    action: "SpecUpdated",
    resource: "tenant:initech-labs gen 7",
    title: "tenant:initech-labs → generation 7",
    requestId: "c0127be4d9a6f3e58b41",
    traceId: "c0127be4d9a6f3e58b41",
    ip: "193.7.x.x",
    idempotencyKey: "8f1e2d3c-4b5a-4697-8877-66554433aa11",
    specHash: "0fa7d9b1",
    diff: [
      { kind: "removed", text: "roles: [tenant_admin, tenant_viewer]" },
      { kind: "added", text: "roles: [tenant_admin, tenant_viewer, tenant_operator]" },
    ],
    relatedRunId: "c0127be4d9a6",
  }),
  event({
    id: "evt_01k4a9k7e2",
    tenant: "globex-logistics",
    occurredAt: `${D}10:08:41.223Z`,
    actor: RECONCILER,
    action: "DriftDetected",
    resource: "zitadel.idp claimMappings",
    title: "drift · zitadel.idp/globex-okta claimMappings changed out-of-band",
    requestId: GLOBEX_RESYNC_REQUEST,
    traceId: GLOBEX_RESYNC_REQUEST,
    diff: [
      { kind: "removed", text: 'claimMappings.email: "email"' },
      { kind: "added", text: 'claimMappings.email: "upn"' },
      { kind: "removed", text: 'claimMappings.groups: "groups"' },
      { kind: "added", text: 'claimMappings.groups: "roles"' },
    ],
    relatedRunId: "a7d30f5c81e9",
  }),
  event({
    id: "evt_01k4a9c0hn",
    tenant: "northwind-rail",
    occurredAt: `${D}09:51:00.090Z`,
    actor: RECONCILER,
    action: "ReconcileFailed",
    resource: "run 2c77 · attempt 8/8",
    title: "run 2c77e0b9a413 → Failed · attempts exhausted",
    requestId: "2c77e0b9a413d5f8c1a6",
    traceId: "2c77e0b9a413d5f8c1a6",
    diff: [
      { kind: "removed", text: "phase: Degraded · attempt 7/8" },
      { kind: "added", text: "phase: Failed · terminal, needs a human" },
      { kind: "context", text: "Zitadel CreateIdentityProvider returned 400 invalid_idp_config" },
    ],
    relatedRunId: "2c77e0b9a413",
  }),
];

/** Unfiltered totals the topbar reports; only the rows above are materialised. */
export const AUDIT_TOTALS: Record<string, number> = {
  "acme-air": 2418,
  "globex-logistics": 1207,
  "northwind-rail": 386,
  "initech-labs": 912,
};
export const AUDIT_TOTAL_DEFAULT = 640;
export const AUDIT_TOTAL_PLATFORM = 9731;
