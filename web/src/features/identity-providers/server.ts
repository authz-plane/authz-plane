import "server-only";

import { getTenant } from "@/features/tenants/server";
import { identityProvidersFor } from "./fixtures";
import { probeIssuer } from "./probe";
import {
  IdentityProviderSchema,
  IdpListSchema,
  ProbeResultSchema,
  StageResultSchema,
  type IdentityProvider,
  type IdpList,
  type IdpPatch,
  type ProbeRequest,
  type ProbeResult,
  type StageResult,
} from "./schemas";

/**
 * Server-side identity-provider access. Pages and the route handlers under
 * /api/tenants/[slug]/identity-providers share these. Fixtures until
 * AuthzPlane.Api exposes the spec's identityProviders block.
 *
 * Edits land in a process-local store (hung off globalThis so every route
 * bundle sees the same one) so the UI reacts; it resets on restart. The store
 * records only `hasSecret`: the secret value is validated, then dropped, and
 * no response shape can carry it.
 */

type Failure = { ok: false; status: number; title: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

const STORE_KEY = Symbol.for("authz-plane.identity-providers");

function store(): Map<string, IdentityProvider[]> {
  const g = globalThis as unknown as Record<symbol, Map<string, IdentityProvider[]> | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

async function providersFor(slug: string): Promise<IdentityProvider[] | null> {
  const cached = store().get(slug);
  if (cached) return cached;
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const items = identityProvidersFor(tenant).map((p) => IdentityProviderSchema.parse(p));
  store().set(slug, items);
  return items;
}

const NOT_FOUND: Failure = { ok: false, status: 404, title: "Tenant not found" };

function idpNotFound(slug: string, id: string): Failure {
  return { ok: false, status: 404, title: "Identity provider not found", detail: `${id} is not a connection in the spec for ${slug}.` };
}

export async function listIdentityProviders(slug: string): Promise<IdpList | null> {
  const [items, tenant] = await Promise.all([providersFor(slug), getTenant(slug)]);
  if (!items || !tenant) return null;
  return IdpListSchema.parse({ slug, items, specGeneration: tenant.generation });
}

export async function getIdentityProvider(slug: string, id: string): Promise<Result<IdentityProvider>> {
  const items = await providersFor(slug);
  if (!items) return NOT_FOUND;
  const idp = items.find((p) => p.id === id);
  return idp ? { ok: true, data: idp } : idpNotFound(slug, id);
}

/** Run the SSRF-guarded probe against an issuer and remember the result on the connection. */
export async function testIdentityProvider(slug: string, id: string, request: ProbeRequest): Promise<Result<ProbeResult>> {
  const items = await providersFor(slug);
  if (!items) return NOT_FOUND;
  const idp = items.find((p) => p.id === id);
  if (!idp) return idpNotFound(slug, id);
  const result = ProbeResultSchema.parse(probeIssuer(request.issuer, request.kind));
  store().set(
    slug,
    items.map((p) => (p.id === id ? { ...p, lastProbe: result } : p)),
  );
  return { ok: true, data: result };
}

/**
 * Stage an edit into the next generation. The connection moves to
 * pending_apply; Zitadel is untouched until the reconciler applies it. A
 * provided secret flips `hasSecret` and is otherwise discarded.
 */
export async function stageIdentityProvider(slug: string, id: string, patch: IdpPatch, now: Date): Promise<Result<StageResult>> {
  const [items, tenant] = await Promise.all([providersFor(slug), getTenant(slug)]);
  if (!items || !tenant) return NOT_FOUND;
  const idp = items.find((p) => p.id === id);
  if (!idp) return idpNotFound(slug, id);

  if (patch.issuer !== undefined) {
    const probe = probeIssuer(patch.issuer, patch.kind ?? idp.kind);
    if (!probe.ok) {
      return { ok: false, status: 422, title: "Issuer rejected", detail: `${probe.reason}: ${probe.detail}` };
    }
  }

  const generation = tenant.generation + 1;
  const issuer = patch.issuer ?? idp.issuer;
  const next: IdentityProvider = IdentityProviderSchema.parse({
    ...idp,
    name: patch.name ?? idp.name,
    kind: patch.kind ?? idp.kind,
    issuer,
    host: new URL(issuer).hostname,
    clientId: patch.clientId ?? idp.clientId,
    hasSecret: idp.hasSecret || patch.clientSecret !== undefined,
    claimMappings: patch.claimMappings ?? idp.claimMappings,
    state: idp.state === "disabled" ? "disabled" : "pending_apply",
    stagedGeneration: generation,
  });
  store().set(
    slug,
    items.map((p) => (p.id === id ? next : p)),
  );
  return {
    ok: true,
    data: StageResultSchema.parse({ id, generation, stagedAt: now.toISOString(), secretReplaced: patch.clientSecret !== undefined }),
  };
}

/** Test hook: forget staged edits and probe results. */
export function resetIdentityProviderStore(): void {
  store().clear();
}
