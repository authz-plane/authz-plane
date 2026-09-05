import type { Phase, TenantDetail, TenantSummary } from "./schemas";

/**
 * Canonical fixture tenants. Every feature's fixtures must reference these
 * slugs so the console tells one consistent story: acme-air is the Degraded
 * tenant at generation 9 / observed 8 with two open drift findings, exactly as
 * the handoff frames show. All names are fictional.
 */

/** The instant every fixture is relative to. Pages pass it down so relative ages render deterministically. */
export const FIXTURE_NOW = "2026-09-04T10:15:00Z";
const T0 = Date.parse(FIXTURE_NOW);
const minutesAgo = (m: number) => new Date(T0 - m * 60_000).toISOString();

function tenant(
  overrides: Partial<TenantSummary> & Pick<TenantSummary, "id" | "slug" | "displayName" | "phase">,
): TenantSummary {
  return {
    generation: 3,
    observedGeneration: 3,
    openDrift: 0,
    lastReconciledAt: minutesAgo(12),
    idp: "oidc · login.microsoftonline.com",
    autoHeal: true,
    resyncIntervalSeconds: 600,
    createdAt: "2026-06-14T09:00:00Z",
    orgId: "214785",
    specHash: "3a91c7e0",
    ...overrides,
  };
}

export const TENANTS: TenantSummary[] = [
  tenant({
    id: "9f2c1a",
    slug: "acme-air",
    displayName: "Acme Air",
    phase: "Degraded",
    generation: 9,
    observedGeneration: 8,
    openDrift: 2,
    lastReconciledAt: minutesAgo(1.6),
    autoHeal: true,
    specHash: "b7e21f04",
  }),
  tenant({
    id: "4d17be",
    slug: "northwind-rail",
    displayName: "Northwind Rail",
    phase: "Failed",
    generation: 4,
    observedGeneration: 3,
    lastReconciledAt: minutesAgo(24),
    idp: "oidc · idp.northwind-rail.example",
    orgId: null,
    specHash: "91d0aa3c",
  }),
  tenant({
    id: "c02e77",
    slug: "globex-logistics",
    displayName: "Globex Logistics",
    phase: "Ready",
    generation: 6,
    observedGeneration: 6,
    openDrift: 4,
    lastReconciledAt: minutesAgo(6),
    idp: "oidc · accounts.google.com",
    autoHeal: false,
    orgId: "214790",
    specHash: "5c8f1e22",
  }),
  tenant({
    id: "e81a05",
    slug: "initech-labs",
    displayName: "Initech Labs",
    phase: "Applying",
    generation: 7,
    observedGeneration: 6,
    lastReconciledAt: minutesAgo(0.3),
    orgId: "214801",
    specHash: "0fa7d9b1",
  }),
  tenant({
    id: "77b3f9",
    slug: "umbrella-health",
    displayName: "Umbrella Health",
    phase: "Ready",
    generation: 12,
    observedGeneration: 12,
    openDrift: 1,
    lastReconciledAt: minutesAgo(3),
    idp: "saml · sso.umbrella-health.example",
    orgId: "214733",
    specHash: "ee41b2c8",
  }),
  tenant({
    id: "a5c0d2",
    slug: "stark-freight",
    displayName: "Stark Freight",
    phase: "Ready",
    generation: 2,
    observedGeneration: 2,
    lastReconciledAt: minutesAgo(9),
    idp: "oidc · login.microsoftonline.com",
    orgId: "214812",
    specHash: "17c3e5f9",
  }),
  tenant({
    id: "3b9e4c",
    slug: "wayne-transit",
    displayName: "Wayne Transit",
    phase: "Deleting",
    generation: 5,
    observedGeneration: 5,
    lastReconciledAt: minutesAgo(0.8),
    idp: null,
    orgId: "214699",
    specHash: "c9a2f043",
  }),
];

/** Total fleet size the dashboard and list footer report; only the 7 above are materialised. */
export const FLEET_TOTAL = 42;

export const FLEET_BY_PHASE: Record<Phase, number> = {
  Pending: 0,
  Planning: 0,
  Applying: 1,
  Ready: 38,
  Degraded: 2,
  Failed: 1,
  Deleting: 0,
};

export const FLEET_WITH_DRIFT = 3;

export function findTenant(slug: string): TenantSummary | undefined {
  return TENANTS.find((t) => t.slug === slug);
}

const DETAILS: Record<string, Omit<TenantDetail, keyof TenantSummary>> = {
  "acme-air": {
    lastError: {
      message: "OpenFGA WriteTuples timed out after 3000ms",
      attempt: 3,
      maxAttempts: 8,
      nextAttemptAt: new Date(T0 + 45_000).toISOString(),
      runId: "8f1c9e4b27d2",
    },
    observedLagSeconds: 96,
    tupleCount: 1284,
    modelVersion: 6,
    desired: {
      identityProviders: ["acme-entra (oidc)", "acme-legacy-saml (disabled)"],
      modelSummary: "v7 staged · 3 types · 8 relations",
      roles: ["tenant_admin", "tenant_editor", "tenant_viewer", "tenant_auditor*"],
      userCount: 312,
      policy: "auto-heal on · resync 600s",
    },
  },
  "northwind-rail": {
    lastError: {
      message: "Zitadel CreateIdentityProvider returned 400 invalid_idp_config",
      attempt: 8,
      maxAttempts: 8,
      nextAttemptAt: null,
      runId: "2c77e0b9a413",
    },
    observedLagSeconds: 1440,
    tupleCount: 96,
    modelVersion: 2,
    desired: {
      identityProviders: ["northwind-okta (oidc)"],
      modelSummary: "v2 · 2 types · 4 relations",
      roles: ["tenant_admin", "tenant_viewer"],
      userCount: 41,
      policy: "auto-heal on · resync 600s",
    },
  },
};

const DEFAULT_DETAIL: Omit<TenantDetail, keyof TenantSummary> = {
  lastError: null,
  observedLagSeconds: 0,
  tupleCount: 240,
  modelVersion: 3,
  desired: {
    identityProviders: ["primary (oidc)"],
    modelSummary: "v3 · 2 types · 5 relations",
    roles: ["tenant_admin", "tenant_viewer"],
    userCount: 58,
    policy: "auto-heal on · resync 600s",
  },
};

/** Detail projection for any summary: the scripted details for acme-air / northwind-rail, defaults otherwise. */
export function tenantDetailFor(summary: TenantSummary): TenantDetail {
  return { ...summary, ...(DETAILS[summary.slug] ?? DEFAULT_DETAIL) };
}

export function tenantDetailFixture(slug: string): TenantDetail | undefined {
  const summary = findTenant(slug);
  return summary ? tenantDetailFor(summary) : undefined;
}
