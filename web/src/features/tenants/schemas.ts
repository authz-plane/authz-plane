import { z } from "zod";

/**
 * Tenant domain shapes shared by every feature. Slugs are immutable and key
 * every tuple, index, and audit row (handoff screen 19), so they are the
 * identifier the UI routes on.
 */

export const PhaseSchema = z.enum([
  "Pending",
  "Planning",
  "Applying",
  "Ready",
  "Degraded",
  "Failed",
  "Deleting",
]);
export type Phase = z.infer<typeof PhaseSchema>;

export const PHASES = PhaseSchema.options;

export const TenantSummarySchema = z.object({
  /** opaque id, e.g. "9f2c1a" */
  id: z.string(),
  slug: z.string(),
  displayName: z.string(),
  phase: PhaseSchema,
  /** desired generation */
  generation: z.number().int().positive(),
  /** last generation the reconciler converged */
  observedGeneration: z.number().int().nonnegative(),
  openDrift: z.number().int().nonnegative(),
  lastReconciledAt: z.string().nullable(),
  /** primary IdP kind + host, e.g. "oidc · login.microsoftonline.com" */
  idp: z.string().nullable(),
  autoHeal: z.boolean(),
  resyncIntervalSeconds: z.number().int().positive(),
  createdAt: z.string(),
  /** Zitadel org id once created by the reconciler */
  orgId: z.string().nullable(),
  specHash: z.string(),
});
export type TenantSummary = z.infer<typeof TenantSummarySchema>;

export const TenantErrorSchema = z.object({
  message: z.string(),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive(),
  nextAttemptAt: z.string().nullable(),
  runId: z.string(),
});
export type TenantError = z.infer<typeof TenantErrorSchema>;

export const TenantDetailSchema = TenantSummarySchema.extend({
  lastError: TenantErrorSchema.nullable(),
  observedLagSeconds: z.number().nonnegative(),
  tupleCount: z.number().int().nonnegative(),
  modelVersion: z.number().int().nonnegative(),
  desired: z.object({
    identityProviders: z.array(z.string()),
    modelSummary: z.string(),
    roles: z.array(z.string()),
    userCount: z.number().int().nonnegative(),
    policy: z.string(),
  }),
});
export type TenantDetail = z.infer<typeof TenantDetailSchema>;

export const TenantListFilterSchema = z.object({
  phase: PhaseSchema.optional(),
  hasDrift: z.boolean().optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(25),
});
export type TenantListFilter = z.infer<typeof TenantListFilterSchema>;

export const TenantPageSchema = z.object({
  items: z.array(TenantSummarySchema),
  nextCursor: z.string().nullable(),
  total: z.number().int().nonnegative(),
  counts: z.object({
    all: z.number().int().nonnegative(),
    byPhase: z.record(PhaseSchema, z.number().int().nonnegative()),
    withDrift: z.number().int().nonnegative(),
  }),
});
export type TenantPage = z.infer<typeof TenantPageSchema>;

/**
 * Slug rules shared by the new-tenant form, the availability check and the
 * create route. Lowercase DNS-label style; route segments are reserved.
 */
export const SLUG_MIN = 3;
export const SLUG_MAX = 63;
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
export const RESERVED_SLUGS: readonly string[] = ["new", "platform", "api", "admin"];

export const SlugSchema = z
  .string()
  .min(SLUG_MIN)
  .max(SLUG_MAX)
  .regex(SLUG_PATTERN)
  .refine((s) => !RESERVED_SLUGS.includes(s), { message: "reserved slug" });

export const StartFromSchema = z.enum(["blank", "copy", "yaml"]);
export type StartFrom = z.infer<typeof StartFromSchema>;

export const StarterModelSchema = z.enum(["roles-only", "documents"]);
export type StarterModel = z.infer<typeof StarterModelSchema>;

/** Body of POST /api/tenants (screen 19). Everything beyond the slug can change in a later generation. */
export const CreateTenantInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  slug: SlugSchema,
  startFrom: StartFromSchema.default("blank"),
  copyFromSlug: z.string().optional(),
  yaml: z.string().max(64_000).optional(),
  starterModel: StarterModelSchema.default("roles-only"),
  autoHeal: z.boolean().default(false),
  resyncIntervalSeconds: z.number().int().min(30).max(86_400).default(600),
});
export type CreateTenantInput = z.infer<typeof CreateTenantInputSchema>;

/** GET /api/tenants/slug-check?slug=… */
export const SlugCheckSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
});
export type SlugCheck = z.infer<typeof SlugCheckSchema>;

/** Tenant lifecycle order used by the chip chain on screen 04. */
export const LIFECYCLE: readonly Phase[] = [
  "Pending",
  "Planning",
  "Applying",
  "Ready",
];
