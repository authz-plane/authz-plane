import "server-only";

import { FIXTURE_NOW } from "@/features/tenants/fixtures";
import { getTenant } from "@/features/tenants/server";
import { usersFor } from "./fixtures";
import {
  InviteResultSchema,
  RefreshResultSchema,
  USERS_PAGE_SIZE,
  UsersPageSchema,
  type InviteRequest,
  type InviteResult,
  type RefreshResult,
  type UserRecord,
  type UsersFilter,
  type UsersPage,
} from "./schemas";

/**
 * Server-side user mirror. Pages and the handlers under
 * /api/tenants/[slug]/users share these. Fixtures until AuthzPlane.Api
 * exposes GET /v1/tenants/{id}/users (cursor paginated), the users:refresh
 * job and invites.
 *
 * The mirror is read-only by design: nothing here edits a user. Refresh
 * enqueues the tenant's resync run and stamps `lastRefreshedAt`; invites go
 * to a process-local list so a duplicate is refused. Both reset on restart.
 */

type Failure = { ok: false; status: number; title: string; detail?: string };
type Result<T> = { ok: true; data: T } | Failure;

interface MirrorState {
  lastRefreshedAt: string;
  lastRefreshRunId: string;
  invited: Set<string>;
}

const STORE_KEY = Symbol.for("authz-plane.users.mirror");

function store(): Map<string, MirrorState> {
  const g = globalThis as unknown as Record<symbol, Map<string, MirrorState> | undefined>;
  return (g[STORE_KEY] ??= new Map());
}

/** Resync runs other features know about; acme-air's is the one frame 18 links to. */
const RESYNC_RUNS: Record<string, string> = {
  "acme-air": "71a0c3d9e5f2",
  "globex-logistics": "a7d30f5c81e9",
};

function hex12(seed: string): string {
  let h = 2166136261;
  let out = "";
  for (let round = 0; out.length < 12; round += 1) {
    const s = `${seed}:${round}`;
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    out += h.toString(16).padStart(8, "0");
  }
  return out.slice(0, 12);
}

function stateFor(slug: string): MirrorState {
  const existing = store().get(slug);
  if (existing) return existing;
  const fresh: MirrorState = {
    // "last refreshed 3m ago by resync run 71a0" at the fixture instant.
    lastRefreshedAt: new Date(Date.parse(FIXTURE_NOW) - 3 * 60_000).toISOString(),
    lastRefreshRunId: RESYNC_RUNS[slug] ?? hex12(`${slug}:resync`),
    invited: new Set(),
  };
  store().set(slug, fresh);
  return fresh;
}

function matches(u: UserRecord, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return u.email.toLowerCase().includes(needle) || u.subject.toLowerCase().includes(needle) || (u.name?.toLowerCase().includes(needle) ?? false);
}

const CURSOR = /^c(\d+)$/;

/** "tenant_auditor*" -> "tenant_auditor" */
function specRoles(roles: readonly string[]): string[] {
  return roles.map((r) => r.replace(/\*$/, ""));
}

export async function listUsers(slug: string, filter: UsersFilter, cursor: string | undefined, limit: number = USERS_PAGE_SIZE): Promise<UsersPage | null> {
  const tenant = await getTenant(slug);
  if (!tenant) return null;
  const all = usersFor(tenant, FIXTURE_NOW);
  const filtered = all.filter((u) => matches(u, filter.q));
  const offset = cursor ? Number(CURSOR.exec(cursor)?.[1] ?? 0) : 0;
  const items = filtered.slice(offset, offset + limit);
  const end = offset + items.length;
  const state = stateFor(slug);
  return UsersPageSchema.parse({
    items,
    nextCursor: end < filtered.length ? `c${end}` : null,
    total: filter.q ? filtered.length : tenant.desired.userCount,
    userCount: tenant.desired.userCount,
    lastRefreshedAt: state.lastRefreshedAt,
    lastRefreshRunId: state.lastRefreshRunId,
    asOf: FIXTURE_NOW,
    stagedGeneration: tenant.generation + 1,
    inviteRoles: specRoles(tenant.desired.roles),
  });
}

/** Enqueue a resync of the mirror from the IdP. 202 with the run that will do it. */
export async function refreshUsers(slug: string, now: Date): Promise<Result<RefreshResult>> {
  const tenant = await getTenant(slug);
  if (!tenant) return { ok: false, status: 404, title: "Tenant not found" };
  const state = stateFor(slug);
  state.lastRefreshedAt = now.toISOString();
  return { ok: true, data: RefreshResultSchema.parse({ runId: state.lastRefreshRunId, enqueuedAt: now.toISOString() }) };
}

/**
 * Invite a user through the IdP. The record appears in the mirror only after
 * the IdP reports it and a resync runs; nothing is written here.
 */
export async function inviteUser(slug: string, request: InviteRequest, now: Date): Promise<Result<InviteResult>> {
  const tenant = await getTenant(slug);
  if (!tenant) return { ok: false, status: 404, title: "Tenant not found" };
  const roles = specRoles(tenant.desired.roles);
  if (!roles.includes(request.role)) {
    return { ok: false, status: 422, title: "Unknown role", detail: `${request.role} is not declared in the spec for ${slug}. Roles: ${roles.join(", ")}.` };
  }
  const email = request.email.toLowerCase();
  const state = stateFor(slug);
  const exists = usersFor(tenant, FIXTURE_NOW).some((u) => u.email.toLowerCase() === email) || state.invited.has(email);
  if (exists) {
    return { ok: false, status: 409, title: "Already a member", detail: `${email} is already in the mirror or has a pending invite.` };
  }
  state.invited.add(email);
  return {
    ok: true,
    data: InviteResultSchema.parse({
      inviteId: `inv_${hex12(`${slug}:${email}`)}`,
      email,
      role: request.role,
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
    }),
  };
}

/** Test hook: forget refreshes and invites. */
export function resetUsersStore(): void {
  store().clear();
}
