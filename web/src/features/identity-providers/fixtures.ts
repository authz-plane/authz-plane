import type { TenantDetail } from "@/features/tenants/schemas";
import { probeIssuer } from "./probe";
import type { ClaimMapping, IdentityProvider, IdpKind } from "./schemas";

/**
 * Identity-provider fixtures. acme-air carries the two connections frame 16
 * shows: acme-entra (oidc against Entra, pending apply in generation 10, 312
 * users, Zitadel id 214785_idp1) and acme-legacy-saml (disabled, phase 2).
 * Every other tenant derives one connection from its tenants fixture so the
 * story stays consistent. All ids and hosts are synthetic.
 */

export const ENTRA_CLAIMS: ClaimMapping[] = [
  { planeField: "email", idpClaim: "preferred_username" },
  { planeField: "name", idpClaim: "name" },
  { planeField: "groups", idpClaim: "groups" },
  { planeField: "externalId", idpClaim: "oid" },
];

const DEFAULT_CLAIMS: ClaimMapping[] = [
  { planeField: "email", idpClaim: "email" },
  { planeField: "name", idpClaim: "name" },
  { planeField: "externalId", idpClaim: "sub" },
];

export const ACME_ENTRA_ISSUER = "https://login.microsoftonline.com/8f2c1a9e-4b7d-4e1f-9c3a-2d5b6e7f8a90/v2.0";

export function acmeIdentityProviders(tenant: TenantDetail): IdentityProvider[] {
  return [
    {
      id: "acme-entra",
      name: "acme-entra",
      kind: "oidc",
      issuer: ACME_ENTRA_ISSUER,
      host: "login.microsoftonline.com",
      clientId: "4f1c9a2e-77b1-4c3d-9e8f-0a1b2c3d4e5f",
      hasSecret: true,
      state: "pending_apply",
      userCount: tenant.desired.userCount,
      externalId: `${tenant.orgId ?? "214785"}_idp1`,
      note: null,
      claimMappings: ENTRA_CLAIMS,
      lastProbe: probeIssuer(ACME_ENTRA_ISSUER, "oidc"),
      stagedGeneration: tenant.generation + 1,
    },
    {
      id: "acme-legacy-saml",
      name: "acme-legacy-saml",
      kind: "saml",
      issuer: "https://sso.acme-air.test/saml/metadata",
      host: "sso.acme-air.test",
      clientId: "urn:acme-air:sp",
      hasSecret: false,
      state: "disabled",
      userCount: 0,
      externalId: null,
      note: "saml · phase 2",
      claimMappings: DEFAULT_CLAIMS,
      lastProbe: null,
      stagedGeneration: null,
    },
  ];
}

/** "northwind-okta (oidc)" -> { name, kind } */
function parseDesired(entry: string): { name: string; kind: IdpKind; disabled: boolean } {
  const m = /^(\S+)\s*\((\w+)\)$/.exec(entry.trim());
  const name = m?.[1] ?? entry.trim();
  const raw = (m?.[2] ?? "oidc").toLowerCase();
  return { name, kind: raw === "saml" ? "saml" : "oidc", disabled: raw === "disabled" };
}

/** "oidc · idp.northwind-rail.example" -> host */
function hostOf(idp: string | null, slug: string): string {
  const host = idp?.split("·")[1]?.trim();
  return host && host.length > 0 ? host : `sso.${slug}.test`;
}

export function genericIdentityProviders(tenant: TenantDetail): IdentityProvider[] {
  const host = hostOf(tenant.idp, tenant.slug);
  const pending = tenant.generation !== tenant.observedGeneration;
  return tenant.desired.identityProviders.map((entry, i) => {
    const { name, kind, disabled } = parseDesired(entry);
    const issuer = kind === "saml" ? `https://${host}/saml/metadata` : `https://${host}/`;
    return {
      id: name,
      name,
      kind,
      issuer,
      host,
      clientId: `${tenant.id}-${name}-client`,
      hasSecret: kind === "oidc",
      state: disabled ? "disabled" : pending && i === 0 ? "pending_apply" : "applied",
      userCount: i === 0 ? tenant.desired.userCount : 0,
      externalId: tenant.orgId ? `${tenant.orgId}_idp${i + 1}` : null,
      note: null,
      claimMappings: DEFAULT_CLAIMS,
      lastProbe: i === 0 ? probeIssuer(issuer, kind) : null,
      stagedGeneration: pending && i === 0 ? tenant.generation + 1 : null,
    };
  });
}

export function identityProvidersFor(tenant: TenantDetail): IdentityProvider[] {
  return tenant.slug === "acme-air" ? acmeIdentityProviders(tenant) : genericIdentityProviders(tenant);
}
