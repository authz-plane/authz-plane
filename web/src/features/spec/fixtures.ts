import type { TenantDetail } from "@/features/tenants/schemas";
import { fnv1a } from "./hash";
import type { Plan, PlanChange, SpecVersion, VersionStatus } from "./schemas";

/**
 * Deterministic spec fixtures for screens 05–07. acme-air's generations tell
 * the same story as features/reconcile: generation 9 (current desired) added
 * the tenant_auditor role, rotated the Entra secret ref and dropped dana's
 * editor tuple; run 8f1c…d2 applied three of those five changes, so observed
 * stays at 8. Every id, hash and name is fictional. Nothing here reads the
 * clock — timestamps are fixed strings.
 */

interface AcmeSpecOptions {
  secretRef: string;
  /** authorization model version the block encodes */
  model: 5 | 6 | 7;
  auditorRole: boolean;
  editorRole: boolean;
  legacyOpsRole: boolean;
  danaTuple: boolean;
  miraTuple: boolean;
  groupsClaim: boolean;
  legacySaml: boolean;
  resyncIntervalSeconds: number;
}

const ACME_MODEL: Record<AcmeSpecOptions["model"], string[]> = {
  5: [
    "model",
    "  schema 1.1",
    "type user",
    "type folder",
    "  relations",
    "    define owner: [user]",
    "    define editor: [user] or owner",
    "    define viewer: [user] or editor",
  ],
  6: [
    "model",
    "  schema 1.1",
    "type user",
    "type folder",
    "  relations",
    "    define owner: [user]",
    "    define editor: [user] or owner",
    "    define viewer: [user] or editor",
    "type document",
    "  relations",
    "    define parent: [folder]",
    "    define owner: [user]",
    "    define editor: [user] or owner or editor from parent",
    "    define viewer: [user] or editor or viewer from parent",
  ],
  7: [
    "model",
    "  schema 1.1",
    "type user",
    "type folder",
    "  relations",
    "    define owner: [user]",
    "    define editor: [user] or owner",
    "    define viewer: [user] or editor",
    "type document",
    "  relations",
    "    define parent: [folder]",
    "    define owner: [user]",
    "    define editor: [user] or owner or editor from parent",
    "    define viewer: [user] or editor or viewer from parent",
    "    define auditor: [user]",
  ],
};

/** README §9.2 style. The gen-9 body is 62 lines with `clientSecretRef` on line 15, as frame 05 shows. */
export function acmeSpec(o: AcmeSpecOptions): string {
  const lines: string[] = [
    "apiVersion: authzplane.dev/v1",
    "kind: Tenant",
    "metadata:",
    "  slug: acme-air",
    "  displayName: Acme Airways",
    "spec:",
    "  reconcilePolicy:",
    "    autoHeal: true",
    `    resyncIntervalSeconds: ${o.resyncIntervalSeconds}`,
    "  identityProviders:",
    "    - name: acme-entra",
    "      kind: oidc",
    "      issuer: https://login.microsoftonline.com/acme-air.example/v2.0",
    "      clientId: acme-air-console",
    `      clientSecretRef: ${o.secretRef}`,
    "      scopes: [openid, profile, email]",
    "      pkce: true",
    "      claimMappings:",
    "        email: email",
    "        name: name",
  ];
  if (o.groupsClaim) lines.push("        groups: groups");
  if (o.legacySaml) {
    lines.push("    - name: acme-legacy-saml", "      kind: saml", "      enabled: false", "      metadataRef: acme-legacy-saml-metadata");
  }
  lines.push("  authorizationModel: |");
  for (const l of ACME_MODEL[o.model]) lines.push(`    ${l}`);
  lines.push("  roles:");
  lines.push("    - key: tenant_admin", "      permissions: [tenant.read, tenant.write, relations.write, audit.read, idp.manage]");
  if (o.editorRole) lines.push("    - key: tenant_editor", "      permissions: [tenant.read, tenant.write, relations.write]");
  lines.push("    - key: tenant_viewer", "      permissions: [tenant.read, audit.read]");
  if (o.auditorRole) lines.push("    - key: tenant_auditor", "      permissions: [tenant.read, audit.read]");
  if (o.legacyOpsRole) lines.push("    - key: tenant_legacy_ops", "      permissions: [tenant.read]");
  lines.push("  relations:");
  lines.push("    - user: user:raj", "      relation: owner", "      object: folder:finance");
  if (o.miraTuple) lines.push("    - user: user:mira", "      relation: auditor", "      object: tenant:acme-air");
  if (o.danaTuple) lines.push("    - user: user:dana", "      relation: editor", "      object: folder:finance");
  lines.push("    - user: user:lee", "      relation: viewer", "      object: document:q3-forecast");
  return lines.join("\n");
}

const GEN9: AcmeSpecOptions = {
  secretRef: "acme-entra-secret",
  model: 7,
  auditorRole: true,
  editorRole: true,
  legacyOpsRole: true,
  danaTuple: false,
  miraTuple: true,
  groupsClaim: true,
  legacySaml: true,
  resyncIntervalSeconds: 600,
};

const GEN8: AcmeSpecOptions = { ...GEN9, secretRef: "acme-entra-old", model: 6, auditorRole: false, danaTuple: true, miraTuple: false };
const GEN7: AcmeSpecOptions = { ...GEN8, legacySaml: false };
const GEN6: AcmeSpecOptions = { ...GEN7, groupsClaim: false };
const GEN5: AcmeSpecOptions = { ...GEN6, model: 5 };
const GEN4: AcmeSpecOptions = { ...GEN5, resyncIntervalSeconds: 900 };
const GEN3: AcmeSpecOptions = { ...GEN4, legacyOpsRole: false };
const GEN2: AcmeSpecOptions = { ...GEN3, editorRole: false };
const GEN1: AcmeSpecOptions = { ...GEN2, secretRef: "acme-entra-bootstrap" };

export const ACME_HUMAN = "ops@acme-air.test";
export const CI_BOT = "ci-bot (m2m)";

interface VersionSeed {
  generation: number;
  author: string;
  createdAt: string;
  summary: string;
  body: string;
}

const ACME_SEEDS: VersionSeed[] = [
  { generation: 9, author: ACME_HUMAN, createdAt: "2026-09-04T10:02:00Z", summary: "+1 role, −1 relation, secret ref rotated", body: acmeSpec(GEN9) },
  { generation: 8, author: ACME_HUMAN, createdAt: "2026-09-02T17:41:00Z", summary: "model v6 · legacy SAML connection (disabled)", body: acmeSpec(GEN8) },
  { generation: 7, author: CI_BOT, createdAt: "2026-08-30T09:00:00Z", summary: "claim mappings · groups", body: acmeSpec(GEN7) },
  { generation: 6, author: ACME_HUMAN, createdAt: "2026-08-28T12:15:00Z", summary: "model v6 · document type", body: acmeSpec(GEN6) },
  { generation: 5, author: ACME_HUMAN, createdAt: "2026-08-21T08:44:00Z", summary: "resync 900s → 600s", body: acmeSpec(GEN5) },
  { generation: 4, author: CI_BOT, createdAt: "2026-08-02T09:00:00Z", summary: "role tenant_legacy_ops", body: acmeSpec(GEN4) },
  { generation: 3, author: ACME_HUMAN, createdAt: "2026-07-15T14:20:00Z", summary: "role tenant_editor", body: acmeSpec(GEN3) },
  { generation: 2, author: ACME_HUMAN, createdAt: "2026-06-20T11:05:00Z", summary: "first Entra connection", body: acmeSpec(GEN2) },
  { generation: 1, author: ACME_HUMAN, createdAt: "2026-06-14T09:00:00Z", summary: "initial spec", body: acmeSpec(GEN1) },
];

/** Status of one generation relative to the tenant's desired/observed pair. */
export function versionStatus(generation: number, current: number, observed: number): VersionStatus {
  if (generation === current) return "current";
  if (generation === observed) return "applied";
  return "superseded";
}

function toVersion(seed: VersionSeed, current: number, observed: number): SpecVersion {
  return {
    generation: seed.generation,
    author: seed.author,
    createdAt: seed.createdAt,
    hash: fnv1a(seed.body),
    summary: seed.summary,
    status: versionStatus(seed.generation, current, observed),
    body: seed.body,
  };
}

/** acme-air: nine generations, newest first. */
export function acmeVersions(): SpecVersion[] {
  return ACME_SEEDS.map((s) => toVersion(s, 9, 8));
}

/**
 * Every other tenant: one generation per `tenant.generation`, built from the
 * canonical tenant projection so the spec agrees with the detail screen.
 */
export function genericSpec(t: TenantDetail, generation: number): string {
  const [kind = "oidc", host = "idp.example"] = (t.idp ?? "oidc · idp.example").split("·").map((s) => s.trim());
  // Older generations carry fewer roles so the diff view has something to show.
  const roles = t.desired.roles.filter((r) => !r.endsWith("*")).slice(0, Math.max(1, t.desired.roles.length - (t.generation - generation)));
  const lines = [
    "apiVersion: authzplane.dev/v1",
    "kind: Tenant",
    "metadata:",
    `  slug: ${t.slug}`,
    `  displayName: ${t.displayName}`,
    "spec:",
    "  reconcilePolicy:",
    `    autoHeal: ${t.autoHeal}`,
    `    resyncIntervalSeconds: ${t.resyncIntervalSeconds}`,
    "  identityProviders:",
    `    - name: ${t.slug}-${kind}`,
    `      kind: ${kind}`,
    `      issuer: https://${host}/`,
    `      clientId: ${t.slug}-console`,
    `      clientSecretRef: ${t.slug}-${kind}-secret`,
    "      claimMappings:",
    "        email: email",
    "        name: name",
    "  authorizationModel: |",
    "    model",
    "      schema 1.1",
    "    type user",
    "    type tenant",
    "      relations",
    "        define admin: [user]",
    "        define viewer: [user] or admin",
    "  roles:",
  ];
  for (const r of roles) {
    lines.push(`    - key: ${r}`);
    lines.push(`      permissions: [${r.endsWith("admin") ? "tenant.read, tenant.write, relations.write, audit.read, idp.manage" : "tenant.read, audit.read"}]`);
  }
  lines.push("  relations: []");
  return lines.join("\n");
}

export function genericVersions(t: TenantDetail): SpecVersion[] {
  const created = Date.parse(t.createdAt);
  const out: SpecVersion[] = [];
  for (let g = t.generation; g >= 1; g--) {
    const body = genericSpec(t, g);
    out.push({
      generation: g,
      author: g % 3 === 0 ? CI_BOT : `ops@${t.slug}.test`,
      createdAt: new Date(created + (g - 1) * 3 * 86_400_000).toISOString(),
      hash: fnv1a(body),
      summary: g === 1 ? "initial spec" : g === t.generation ? "current desired state" : `generation ${g}`,
      status: versionStatus(g, t.generation, t.observedGeneration),
      body,
    });
  }
  return out;
}

/** Frame 07's seven changes, in dependency order. `changeKey` is 12 hex so `shortHash` renders `3a91…c7`. */
export function planChanges(displayName: string): PlanChange[] {
  return [
    { op: "create", kind: "zitadel.org", description: `create org "${displayName}"`, changeKey: "3a91e02b5dc7" },
    { op: "update", kind: "zitadel.idp", description: "update acme-entra · clientSecret (write-only), claimMappings.name", changeKey: "7b02d4a8f114" },
    { op: "update", kind: "fga.model", description: "write authorization model v7 · +1 type, +2 relations", changeKey: "91cd3e7b25a0" },
    { op: "create", kind: "plane.role", description: "create role tenant_auditor · permissions [audit.read]", changeKey: "55fe0c9a7d31" },
    { op: "create", kind: "fga.tuple", description: "write user:mira auditor tenant:acme-air", changeKey: "2ab7f13c9e6d" },
    { op: "create", kind: "fga.tuple", description: "write user:mira viewer folder:finance", changeKey: "d4107e2f9c8e" },
    { op: "delete", kind: "fga.tuple", description: "delete user:dana editor folder:finance", changeKey: "0e3f6a1d47b2" },
  ];
}

export const PLAN_UNCHANGED = 18;

/** Pure planner output: 4 create / 2 update / 1 delete / 18 unchanged. `actualReadAt` is 38s before `now` (10:14:22Z at fixture time). */
export function planFixture(slug: string, displayName: string, generation: number, now: Date): Plan {
  const changes = planChanges(displayName);
  return {
    slug,
    generation,
    actualReadAt: new Date(now.getTime() - 38_000).toISOString(),
    summary: {
      create: changes.filter((c) => c.op === "create").length,
      update: changes.filter((c) => c.op === "update").length,
      delete: changes.filter((c) => c.op === "delete").length,
      unchanged: PLAN_UNCHANGED,
    },
    changes,
  };
}
