import { z } from "zod";

/**
 * Wire shapes for the tenant spec (handoff screens 05–07). Client-safe: no
 * server imports. Secrets never appear here — the spec carries `clientSecretRef`
 * names only, and a literal `clientSecret:` is a validation warning.
 */

/** GET /api/tenants/{slug}/spec — the current desired-state document. */
export const SpecDocumentSchema = z.object({
  slug: z.string().min(1),
  generation: z.number().int().positive(),
  body: z.string(),
  /** 8 hex chars; the UI shows `b7e2…04` */
  hash: z.string().regex(/^[0-9a-f]{8}$/),
  lineCount: z.number().int().nonnegative(),
  updatedAt: z.string(),
});
export type SpecDocument = z.infer<typeof SpecDocumentSchema>;

export const VersionStatusSchema = z.enum(["current", "applied", "superseded"]);
export type VersionStatus = z.infer<typeof VersionStatusSchema>;

export const SpecVersionSchema = z.object({
  generation: z.number().int().positive(),
  /** human email or "ci-bot (m2m)" */
  author: z.string().min(1),
  createdAt: z.string(),
  hash: z.string().regex(/^[0-9a-f]{8}$/),
  summary: z.string(),
  status: VersionStatusSchema,
  body: z.string(),
});
export type SpecVersion = z.infer<typeof SpecVersionSchema>;

export const SpecVersionsSchema = z.object({
  slug: z.string().min(1),
  /** newest first */
  items: z.array(SpecVersionSchema),
  total: z.number().int().nonnegative(),
  currentGeneration: z.number().int().positive(),
  observedGeneration: z.number().int().nonnegative(),
});
export type SpecVersions = z.infer<typeof SpecVersionsSchema>;

export const ValidationLevelSchema = z.enum(["ok", "warning", "error"]);
export type ValidationLevel = z.infer<typeof ValidationLevelSchema>;

export const ValidationIssueSchema = z.object({
  level: ValidationLevelSchema,
  title: z.string().min(1),
  detail: z.string(),
  /** 1-based line the issue points at; null for document-wide results */
  line: z.number().int().positive().nullable(),
});
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;

/** POST /api/tenants/{slug}/spec/validate */
export const ValidateRequestSchema = z.object({ body: z.string() });
export const ValidationResponseSchema = z.object({
  results: z.array(ValidationIssueSchema),
  errors: z.number().int().nonnegative(),
  warnings: z.number().int().nonnegative(),
  lineCount: z.number().int().nonnegative(),
  valid: z.boolean(),
  durationMs: z.number().int().nonnegative(),
});
export type ValidationResponse = z.infer<typeof ValidationResponseSchema>;

/** PUT /api/tenants/{slug}/spec body; `If-Match` travels as a header. */
export const SaveSpecRequestSchema = z.object({ body: z.string().min(1) });

/** 202 from PUT …/spec and POST …/spec/versions/{gen}/restore */
export const SaveSpecResponseSchema = z.object({
  generation: z.number().int().positive(),
  runId: z.string().regex(/^[0-9a-f]{12}$/),
});
export type SaveSpecResponse = z.infer<typeof SaveSpecResponseSchema>;

/** 202 from POST …/reconcile */
export const ReconcileAcceptedSchema = z.object({
  runId: z.string().regex(/^[0-9a-f]{12}$/),
});
export type ReconcileAccepted = z.infer<typeof ReconcileAcceptedSchema>;

export const PlanOpSchema = z.enum(["create", "update", "delete"]);
export type PlanOp = z.infer<typeof PlanOpSchema>;

export const PlanChangeSchema = z.object({
  op: PlanOpSchema,
  /** resource kind in dependency order: zitadel.org, zitadel.idp, fga.model, plane.role, fga.tuple */
  kind: z.string().min(1),
  description: z.string().min(1),
  /** 12 hex chars; shown as `3a91…c7` */
  changeKey: z.string().regex(/^[0-9a-f]{12}$/),
});
export type PlanChange = z.infer<typeof PlanChangeSchema>;

/** POST /api/tenants/{slug}/reconcile?dryRun=true — screen 07. Optional body { body } plans a draft. */
export const PlanRequestSchema = z.object({ body: z.string().optional() });
export const PlanSchema = z.object({
  slug: z.string().min(1),
  generation: z.number().int().positive(),
  /** when the planner read actual state */
  actualReadAt: z.string(),
  summary: z.object({
    create: z.number().int().nonnegative(),
    update: z.number().int().nonnegative(),
    delete: z.number().int().nonnegative(),
    unchanged: z.number().int().nonnegative(),
  }),
  changes: z.array(PlanChangeSchema),
});
export type Plan = z.infer<typeof PlanSchema>;

/** `3a91e02b5dc7` → `3a91…c7`, `b7e21f04` → `b7e2…04` */
export function shortHash(hash: string): string {
  if (hash.length <= 6) return hash;
  return `${hash.slice(0, 4)}…${hash.slice(-2)}`;
}
