import type { ModelVersion } from "./schemas";

/**
 * Fixture DSL for the acme-air tenant (frame 12): v6 is live and serving
 * checks, v7 adds `define auditor` on document and is being edited. Other
 * tenants get a generic two-type model at their tenant's modelVersion.
 */

export const ACME_LIVE_DSL_V6 = `model
  schema 1.1

type user

type folder
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor

type document
  relations
    define parent: [folder]
    define owner: [user]
    define editor: [user] or owner or editor from parent
    define viewer: [user] or editor or viewer from parent
`;

export const ACME_DRAFT_DSL_V7 = `model
  schema 1.1

type user

type folder
  relations
    define owner: [user]
    define editor: [user] or owner
    define viewer: [user] or editor

type document
  relations
    define parent: [folder]
    define owner: [user]
    define editor: [user] or owner or editor from parent
    define viewer: [user] or editor or viewer from parent
    define auditor: [user]
`;

export const GENERIC_DSL = `model
  schema 1.1

type user

type project
  relations
    define admin: [user]
    define editor: [user] or admin
    define commenter: [user] or editor
    define viewer: [user] or commenter
    define billing: [user]
`;

/** Version history v1..v7 for acme-air. Timestamps are fixed UTC strings. */
export const ACME_VERSIONS: ModelVersion[] = [
  { version: 1, author: "raj.kolekar", createdAt: "2026-06-14T09:12:00Z", summary: "initial model · user, folder", state: "superseded" },
  { version: 2, author: "ci-bot (m2m)", createdAt: "2026-06-20T14:03:00Z", summary: "add document type", state: "superseded" },
  { version: 3, author: "raj.kolekar", createdAt: "2026-07-02T08:41:00Z", summary: "document.parent → folder", state: "superseded" },
  { version: 4, author: "mira.o", createdAt: "2026-07-18T16:20:00Z", summary: "editor inherits from parent", state: "superseded" },
  { version: 5, author: "ci-bot (m2m)", createdAt: "2026-08-05T11:55:00Z", summary: "viewer inherits from parent", state: "superseded" },
  { version: 6, author: "raj.kolekar", createdAt: "2026-08-21T09:30:00Z", summary: "add owner on folder + document", state: "live" },
  { version: 7, author: "raj.kolekar", createdAt: "2026-09-04T09:58:00Z", summary: "add auditor on document (staging into gen 10)", state: "draft" },
];

/** Generic history for tenants that are not acme-air. */
export function genericVersions(liveVersion: number): ModelVersion[] {
  return Array.from({ length: liveVersion }, (_, i) => {
    const version = i + 1;
    return {
      version,
      author: version % 2 === 0 ? "ci-bot (m2m)" : "raj.kolekar",
      createdAt: `2026-0${Math.min(6 + i, 8)}-1${version}T10:00:00Z`,
      summary: version === 1 ? "initial model" : `revision ${version}`,
      state: version === liveVersion ? "live" : "superseded",
    } satisfies ModelVersion;
  });
}

/** Cached decisions tagged with the live model version; invalidated when a new version is written. */
export const ACME_CACHED_DECISIONS = 41;
