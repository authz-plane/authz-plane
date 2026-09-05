import { z } from "zod";

/**
 * Wire shapes for /api/tenants/[slug]/authorization-model. Client-safe.
 * The .NET API has no model endpoints yet; fixtures produce these shapes and
 * the server side will map real responses into them later.
 */

export const ModelVersionSchema = z.object({
  version: z.number().int().positive(),
  author: z.string(),
  createdAt: z.string(),
  summary: z.string(),
  /** live = applied and serving checks; draft = being edited, not staged */
  state: z.enum(["live", "draft", "superseded"]),
});
export type ModelVersion = z.infer<typeof ModelVersionSchema>;

export const AuthorizationModelSchema = z.object({
  slug: z.string(),
  liveVersion: z.number().int().positive(),
  /** null when nothing is being edited */
  draftVersion: z.number().int().positive().nullable(),
  live: z.string(),
  draft: z.string(),
  versions: z.array(ModelVersionSchema),
  tupleCount: z.number().int().nonnegative(),
  cachedDecisions: z.number().int().nonnegative(),
});
export type AuthorizationModel = z.infer<typeof AuthorizationModelSchema>;

export const ValidateRequestSchema = z.object({
  dsl: z.string().min(1).max(64_000),
});
export type ValidateRequest = z.infer<typeof ValidateRequestSchema>;

export const ValidationIssueSchema = z.object({
  line: z.number().int().positive(),
  message: z.string(),
});

export const ValidationResultSchema = z.object({
  ok: z.boolean(),
  types: z.number().int().nonnegative(),
  relations: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
  issues: z.array(ValidationIssueSchema),
  /** existing tuples that would still validate against this DSL */
  tuplesValidated: z.number().int().nonnegative(),
  elapsedMs: z.number().int().nonnegative(),
});
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

export const StageRequestSchema = ValidateRequestSchema;

export const StageResultSchema = z.object({
  /** spec generation the model change was staged into */
  generation: z.number().int().positive(),
  version: z.number().int().positive(),
  stagedAt: z.string(),
});
export type StageResult = z.infer<typeof StageResultSchema>;
