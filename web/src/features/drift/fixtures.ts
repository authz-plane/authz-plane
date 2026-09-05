import { findTenant } from "@/features/tenants/fixtures";
import type { DriftFinding } from "./schemas";

/**
 * Seven open findings across three tenants, consistent with the canonical
 * tenants (acme-air 2, globex-logistics 4, umbrella-health 1) and with frame
 * 10/11: the globex claimMappings.email finding is `9c1f7e2a`, detected 6m
 * before "now" by resync run a7d3. Takes `now` so tests stay deterministic.
 */

function minutesBefore(now: Date, m: number): string {
  return new Date(now.getTime() - Math.round(m * 60_000)).toISOString();
}

interface Seed {
  id: string;
  tenant: string;
  kind: string;
  path: string;
  ref: string;
  desired: string | null;
  actual: string | null;
  severity: DriftFinding["severity"];
  ageMinutes: number;
  detectedByRun: string;
  title: string;
  impact: string;
  evidence: DriftFinding["evidence"];
  healPlan: DriftFinding["healPlan"];
  reconcileRunId: string | null;
}

const GLOBEX_EVIDENCE = {
  actualStateHash: "2f08…9c",
  lastKnownHash: "8b41…07",
  siblingFindings: 4,
  conclusion: "likely a direct edit in the Zitadel console",
};

// 10:08:41Z when "now" is 10:15:00Z, as the frame 11 provenance line reads.
const GLOBEX_AGE_MINUTES = 6 + 19 / 60;

const SEEDS: Seed[] = [
  {
    id: "9c1f7e2a",
    tenant: "globex-logistics",
    kind: "zitadel.idp",
    path: "claimMappings.email",
    ref: "zitadel.idp/globex-okta",
    desired: '"email"',
    actual: '"upn"',
    severity: "high",
    ageMinutes: GLOBEX_AGE_MINUTES,
    detectedByRun: "a7d3",
    title: "claimMappings.email changed out-of-band",
    impact: "logins map to a different subject key",
    evidence: GLOBEX_EVIDENCE,
    healPlan: {
      resource: "zitadel.idp",
      description: 'set claimMappings.email = "email"',
      changeKey: "7b02…14",
    },
    reconcileRunId: null,
  },
  {
    id: "e4b2a9d1",
    tenant: "globex-logistics",
    kind: "fga.tuple",
    path: "user:ext-audit admin tenant",
    ref: "fga.store/globex",
    desired: null,
    actual: "present",
    severity: "high",
    ageMinutes: GLOBEX_AGE_MINUTES,
    detectedByRun: "a7d3",
    title: "unexpected tuple user:ext-audit admin tenant",
    impact: "an external subject holds admin on the tenant object",
    evidence: {
      ...GLOBEX_EVIDENCE,
      conclusion: "likely a direct write to the OpenFGA store",
    },
    healPlan: {
      resource: "fga.tuple",
      description: "delete user:ext-audit admin tenant:globex",
      changeKey: "c41e…8a",
    },
    reconcileRunId: null,
  },
  {
    id: "b71c0f3e",
    tenant: "globex-logistics",
    kind: "zitadel.idp",
    path: "claimMappings.groups",
    ref: "zitadel.idp/globex-okta",
    desired: '"groups"',
    actual: '"roles"',
    severity: "medium",
    ageMinutes: GLOBEX_AGE_MINUTES,
    detectedByRun: "a7d3",
    title: "claimMappings.groups changed out-of-band",
    impact: "group-derived roles stop resolving",
    evidence: GLOBEX_EVIDENCE,
    healPlan: {
      resource: "zitadel.idp",
      description: 'set claimMappings.groups = "groups"',
      changeKey: "9d3a…f2",
    },
    reconcileRunId: null,
  },
  {
    id: "5d0e8c47",
    tenant: "globex-logistics",
    kind: "zitadel.org",
    path: "passwordPolicy.minLength",
    ref: "zitadel.org/214790",
    desired: "12",
    actual: "8",
    severity: "medium",
    ageMinutes: GLOBEX_AGE_MINUTES,
    detectedByRun: "a7d3",
    title: "passwordPolicy.minLength lowered out-of-band",
    impact: "weaker than the tenant policy requires",
    evidence: GLOBEX_EVIDENCE,
    healPlan: {
      resource: "zitadel.org",
      description: "set passwordPolicy.minLength = 12",
      changeKey: "0a77…3c",
    },
    reconcileRunId: null,
  },
  {
    id: "3a6f2d91",
    tenant: "acme-air",
    kind: "zitadel.org",
    path: "displayName",
    ref: "zitadel.org/214785",
    desired: '"Acme Airways"',
    actual: '"Acme Air (test)"',
    severity: "medium",
    ageMinutes: 22,
    detectedByRun: "71a0",
    title: "displayName changed out-of-band",
    impact: "branding on the hosted login page differs from the spec",
    evidence: {
      actualStateHash: "6c1d…e4",
      lastKnownHash: "b7e2…04",
      siblingFindings: 2,
      conclusion: "likely a direct edit in the Zitadel console",
    },
    healPlan: {
      resource: "zitadel.org",
      description: 'set displayName = "Acme Airways"',
      changeKey: "51fe…9d",
    },
    reconcileRunId: "8f1c9e4b27d2",
  },
  {
    id: "c8e15b70",
    tenant: "acme-air",
    kind: "fga.model",
    path: "document#viewer",
    ref: "fga.model/01J8…Q2",
    desired: "v7",
    actual: "v6",
    severity: "medium",
    ageMinutes: 60,
    detectedByRun: "71a0",
    title: "authorization model behind desired version",
    impact: "document#viewer checks evaluate against v6",
    evidence: {
      actualStateHash: "6c1d…e4",
      lastKnownHash: "b7e2…04",
      siblingFindings: 2,
      conclusion: "model v7 is staged in generation 9, which has not applied",
    },
    healPlan: {
      resource: "fga.model",
      description: "write authorization model v7",
      changeKey: "e90b…21",
    },
    reconcileRunId: "8f1c9e4b27d2",
  },
  {
    id: "f20d4a6b",
    tenant: "umbrella-health",
    kind: "zitadel.user",
    path: "count",
    ref: "zitadel.org/214733",
    desired: "184",
    actual: "181",
    severity: "low",
    ageMinutes: 4 * 60 + 12,
    detectedByRun: "5e9c",
    title: "user count differs from the IdP mirror",
    impact: "three users exist in the IdP that the spec does not know about",
    evidence: {
      actualStateHash: "a9f0…12",
      lastKnownHash: "ee41…c8",
      siblingFindings: 1,
      conclusion: "users are owned by the IdP; this is informational",
    },
    healPlan: {
      resource: "zitadel.user",
      description: "refresh user mirror from IdP",
      changeKey: "33d1…7e",
    },
    reconcileRunId: null,
  },
];

/** Baseline for the "Healed today" stat; heals performed in-session add to it. */
export const HEALED_TODAY_BASELINE = 19;

/** Minutes before `now` that the last fleet-wide resync ran ("last resync 4m ago"). */
export const LAST_RESYNC_MINUTES_AGO = 4;

export function driftFixtures(now: Date): DriftFinding[] {
  return SEEDS.map((s) => ({
    id: s.id,
    tenant: s.tenant,
    autoHeal: findTenant(s.tenant)?.autoHeal ?? false,
    resource: { kind: s.kind, path: s.path, ref: s.ref },
    desired: s.desired,
    actual: s.actual,
    severity: s.severity,
    status: "open",
    detectedAt: minutesBefore(now, s.ageMinutes),
    detectedByRun: s.detectedByRun,
    title: s.title,
    impact: s.impact,
    evidence: s.evidence,
    healPlan: s.healPlan,
    reconcileRunId: s.reconcileRunId,
  }));
}
