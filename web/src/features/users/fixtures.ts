import type { TenantDetail } from "@/features/tenants/schemas";
import type { UserRecord, UserRole } from "./schemas";

/**
 * User-mirror fixtures. acme-air materialises 16 of its 312 users (two pages
 * of 8) and tells frame 18's story: one staged auditor role (generation 10),
 * one pending tuple delete, one unmanaged external subject with a drift role.
 * Every name and address is synthetic; the domain is acme-air.test.
 */

const applied = (name: string): UserRole => ({ name, state: "applied" });

interface Seed {
  first: string;
  last: string;
  roles?: UserRole[];
  tuples?: number;
  pendingDeletes?: number;
  lastSeenMinutesAgo?: number | null;
}

const ACME_SEEDS: Seed[] = [
  { first: "Ana", last: "Ruiz", roles: [applied("tenant_admin")], tuples: 6, lastSeenMinutesAgo: 4 },
  { first: "Mira", last: "Banerjee", roles: [{ name: "tenant_auditor", state: "staged" }], tuples: 2, lastSeenMinutesAgo: 41 },
  { first: "Dana", last: "Lopez", roles: [applied("tenant_viewer")], tuples: 1, pendingDeletes: 1, lastSeenMinutesAgo: 130 },
  { first: "Lee", last: "Okafor", roles: [applied("tenant_editor")], tuples: 4, lastSeenMinutesAgo: 9 },
  { first: "Priya", last: "Natarajan", roles: [applied("tenant_editor")], tuples: 3, lastSeenMinutesAgo: 22 },
  { first: "Tomas", last: "Berg", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 600 },
  { first: "Yuki", last: "Tanaka", roles: [applied("tenant_viewer")], tuples: 2, lastSeenMinutesAgo: 75 },
  { first: "Sofia", last: "Marino", roles: [applied("tenant_admin")], tuples: 5, lastSeenMinutesAgo: 1 },
  { first: "Omar", last: "Haddad", roles: [applied("tenant_editor")], tuples: 3, lastSeenMinutesAgo: 300 },
  { first: "Ingrid", last: "Solberg", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 1440 },
  { first: "Kwame", last: "Mensah", roles: [applied("tenant_viewer")], tuples: 2, lastSeenMinutesAgo: 55 },
  { first: "Elena", last: "Petrova", roles: [applied("tenant_editor")], tuples: 2, lastSeenMinutesAgo: 12 },
  { first: "Ravi", last: "Iyer", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 2880 },
  { first: "Chloe", last: "Dubois", roles: [applied("tenant_viewer")], tuples: 0, lastSeenMinutesAgo: null },
  { first: "Mateo", last: "Silva", roles: [applied("tenant_editor")], tuples: 3, lastSeenMinutesAgo: 30 },
];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function user(seed: Seed, domain: string, now: number): UserRecord {
  const first = slugify(seed.first);
  const last = slugify(seed.last);
  return {
    id: `usr_${first}_${last}`,
    subject: `user:${first}`,
    name: `${seed.first} ${seed.last}`,
    email: `${first}.${last}@${domain}`,
    roles: seed.roles ?? [applied("tenant_viewer")],
    tupleCount: seed.tuples ?? 1,
    pendingDeletes: seed.pendingDeletes ?? 0,
    state: "active",
    lastSeenAt: seed.lastSeenMinutesAgo == null ? null : new Date(now - seed.lastSeenMinutesAgo * 60_000).toISOString(),
  };
}

/** The unmanaged row: a vendor subject holding an admin tuple that desired state never granted. */
function externalAuditor(now: number): UserRecord {
  return {
    id: "usr_ext_audit",
    subject: "user:ext-audit",
    name: null,
    email: "ext-audit@vendor.test",
    roles: [{ name: "admin", state: "drift" }],
    tupleCount: 1,
    pendingDeletes: 0,
    state: "unmanaged",
    lastSeenAt: new Date(now - 6 * 60_000).toISOString(),
  };
}

export function acmeUsers(now: string): UserRecord[] {
  const t = Date.parse(now);
  const [ana, mira, dana, ...rest] = ACME_SEEDS.map((s) => user(s, "acme-air.test", t));
  return [ana!, mira!, dana!, externalAuditor(t), ...rest];
}

const GENERIC_SEEDS: Seed[] = [
  { first: "Noor", last: "Rahman", roles: [applied("tenant_admin")], tuples: 4, lastSeenMinutesAgo: 8 },
  { first: "Felix", last: "Brandt", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 90 },
  { first: "Aisha", last: "Bello", roles: [applied("tenant_viewer")], tuples: 2, lastSeenMinutesAgo: 15 },
  { first: "Hugo", last: "Lindqvist", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 400 },
  { first: "Leila", last: "Farahani", roles: [applied("tenant_viewer")], tuples: 1, lastSeenMinutesAgo: 60 },
];

export function genericUsers(tenant: TenantDetail, now: string): UserRecord[] {
  const t = Date.parse(now);
  const count = Math.min(GENERIC_SEEDS.length, Math.max(1, Math.ceil(tenant.desired.userCount / 12)));
  return GENERIC_SEEDS.slice(0, count).map((s) => user(s, `${tenant.slug}.test`, t));
}

export function usersFor(tenant: TenantDetail, now: string): UserRecord[] {
  return tenant.slug === "acme-air" ? acmeUsers(now) : genericUsers(tenant, now);
}

/** Initials for the 28px avatar: two letters from the name, or from the email's local part. */
export function initialsFor(u: Pick<UserRecord, "name" | "email">): string {
  if (u.name) {
    return u.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("");
  }
  const local = u.email.split("@")[0] ?? "";
  const parts = local.split(/[.\-_]/).filter(Boolean);
  return (parts.length >= 2 ? `${parts[0]![0]}${parts[1]![0]}` : local.slice(0, 2)).toUpperCase();
}
