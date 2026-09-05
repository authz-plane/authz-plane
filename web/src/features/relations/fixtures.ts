import type { Tuple } from "./schemas";

/**
 * acme-air tuples (frame 14). Only 12 of the 1 284 are materialised: two
 * pages of six so cursor pagination is exercised. One row is drift: the
 * `admin` relation on `tenant:acme-air` is not in the model and not in the
 * spec, so it is "unmanaged".
 */
export const ACME_TUPLE_TOTAL = 1284;

export function acmeTuples(): Tuple[] {
  return [
    { id: "t-0001", user: "user:raj", relation: "editor", object: "folder:finance", source: { kind: "spec", generation: 6 }, writtenAt: "2026-08-30T09:12:00Z" },
    { id: "t-0002", user: "user:raj", relation: "viewer", object: "folder:ops", source: { kind: "api" }, writtenAt: "2026-09-01T14:40:00Z" },
    { id: "t-0003", user: "user:mira", relation: "viewer", object: "folder:finance", source: { kind: "api" }, writtenAt: "2026-09-02T08:05:00Z" },
    { id: "t-0004", user: "folder:finance", relation: "parent", object: "document:budget-2026", source: { kind: "spec", generation: 5 }, writtenAt: "2026-08-21T10:00:00Z" },
    { id: "t-0005", user: "user:ext-audit", relation: "admin", object: "tenant:acme-air", source: { kind: "drift" }, writtenAt: "2026-09-03T22:17:00Z" },
    { id: "t-0006", user: "user:dana", relation: "editor", object: "folder:finance", source: { kind: "spec", generation: 8 }, writtenAt: "2026-09-02T16:30:00Z" },
    { id: "t-0007", user: "user:raj", relation: "owner", object: "folder:finance", source: { kind: "spec", generation: 6 }, writtenAt: "2026-08-30T09:12:00Z" },
    { id: "t-0008", user: "user:mira", relation: "editor", object: "folder:ops", source: { kind: "spec", generation: 6 }, writtenAt: "2026-08-30T09:12:00Z" },
    { id: "t-0009", user: "folder:ops", relation: "parent", object: "document:runbook-q3", source: { kind: "spec", generation: 5 }, writtenAt: "2026-08-21T10:00:00Z" },
    { id: "t-0010", user: "user:dana", relation: "viewer", object: "document:budget-2026", source: { kind: "api" }, writtenAt: "2026-09-03T11:25:00Z" },
    { id: "t-0011", user: "user:lee", relation: "viewer", object: "folder:finance", source: { kind: "api" }, writtenAt: "2026-09-04T07:48:00Z" },
    { id: "t-0012", user: "user:sam", relation: "owner", object: "folder:ops", source: { kind: "spec", generation: 6 }, writtenAt: "2026-08-30T09:12:00Z" },
  ];
}

/** Other tenants: a handful of tuples on the generic `project` type. */
export function genericTuples(slug: string, generation: number): Tuple[] {
  return [
    { id: "g-0001", user: "user:raj", relation: "admin", object: `project:${slug}-core`, source: { kind: "spec", generation }, writtenAt: "2026-08-12T09:00:00Z" },
    { id: "g-0002", user: "user:mira", relation: "editor", object: `project:${slug}-core`, source: { kind: "spec", generation }, writtenAt: "2026-08-12T09:00:00Z" },
    { id: "g-0003", user: "user:dana", relation: "viewer", object: `project:${slug}-core`, source: { kind: "api" }, writtenAt: "2026-09-01T12:30:00Z" },
    { id: "g-0004", user: "user:lee", relation: "commenter", object: `project:${slug}-docs`, source: { kind: "api" }, writtenAt: "2026-09-02T15:10:00Z" },
  ];
}

/** Decisions cached under the live model-version tag; a write invalidates them before returning. */
export const CACHED_DECISIONS: Record<string, number> = { "acme-air": 41 };
export const DEFAULT_CACHED_DECISIONS = 12;
