import { z } from "zod";

/**
 * Wire shapes for the audit screen (17). The .NET API has no audit endpoints
 * yet; this is the contract the fixtures and the UI agree on, mapped from
 * GET /v1/tenants/{id}/audit-events once it lands. The table is append-only
 * on the server (no UPDATE/DELETE grant), so nothing here mutates an event.
 */

export const AuditActionSchema = z.enum([
  "SpecUpdated",
  "ReconcileSucceeded",
  "ReconcileDegraded",
  "ReconcileFailed",
  "DriftDetected",
  "DriftHealed",
  "DriftAcknowledged",
  "RelationsWritten",
  "TupleWritten",
  "IdpSecretRotated",
  "CheckExplained",
  "TenantCreated",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;
export const AUDIT_ACTIONS = AuditActionSchema.options;

export const ActorKindSchema = z.enum(["human", "system", "m2m"]);
export type ActorKind = z.infer<typeof ActorKindSchema>;

export const ActorSchema = z.object({
  /** filter value, e.g. "ops@acme-air.test", "system:reconciler", "ci-bot" */
  id: z.string().min(1),
  kind: ActorKindSchema,
  /** what the ACTOR column shows, e.g. "ci-bot (m2m)" */
  label: z.string().min(1),
});
export type Actor = z.infer<typeof ActorSchema>;

export const DiffLineKindSchema = z.enum(["removed", "added", "changed", "context"]);

export const AuditEventSchema = z.object({
  id: z.string().min(1),
  tenant: z.string().min(1),
  /** ISO with millisecond precision; the panel shows it, the table shows seconds */
  occurredAt: z.string(),
  actor: ActorSchema,
  action: AuditActionSchema,
  /** RESOURCE column, e.g. "tenant:acme-air gen 9" */
  resource: z.string().min(1),
  /** panel title, e.g. "tenant:acme-air → generation 9" */
  title: z.string().min(1),
  /** full request id; the table shows shortId() of it */
  requestId: z.string().min(1),
  traceId: z.string().nullable(),
  /** already masked by the API, e.g. "82.14.x.x"; null for system actors */
  ip: z.string().nullable(),
  idempotencyKey: z.string().nullable(),
  specHash: z.string().nullable(),
  /** BEFORE / AFTER lines; context lines for read-only events */
  diff: z.array(z.object({ kind: DiffLineKindSchema, text: z.string() })),
  relatedRunId: z.string().nullable(),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AuditFilterSchema = z.object({
  /** only meaningful on the platform page; the tenant route fixes it */
  tenant: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  action: AuditActionSchema.optional(),
});
export type AuditFilter = z.infer<typeof AuditFilterSchema>;

export const AuditPageSchema = z.object({
  generatedAt: z.string(),
  items: z.array(AuditEventSchema),
  /** opaque; pass back as ?cursor= to load older events */
  nextCursor: z.string().nullable(),
  /** unfiltered count for the scope ("2 418 events"); filtered count when a filter is on */
  total: z.number().int().nonnegative(),
  /** distinct actors in the scope, for the actor select */
  actors: z.array(ActorSchema),
});
export type AuditPage = z.infer<typeof AuditPageSchema>;

export const ExportResponseSchema = z.object({
  exportId: z.string().min(1),
  status: z.literal("queued"),
  format: z.literal("ndjson.gz"),
});
export type ExportResponse = z.infer<typeof ExportResponseSchema>;

/** Parse ?tenant=&actor=&action= from a record or URLSearchParams; invalid values are dropped, never thrown. */
export function auditFilterFromSearch(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): AuditFilter {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const tenant = get("tenant");
  const actor = get("actor");
  const action = AuditActionSchema.safeParse(get("action"));
  return {
    ...(tenant ? { tenant } : {}),
    ...(actor ? { actor } : {}),
    ...(action.success ? { action: action.data } : {}),
  };
}
