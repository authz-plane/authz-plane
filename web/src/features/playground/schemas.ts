import { z } from "zod";

/**
 * Wire shapes for the permission playground (screen 15). The explain response
 * follows system design §9.1: `why`, not just `whether`. Every decisive leaf
 * names the tuple, who wrote it and when, so the UI can link it to audit.
 */

export const ConsistencySchema = z.enum(["strong", "eventual"]);
export type Consistency = z.infer<typeof ConsistencySchema>;

/** `type:id` for objects and `type:id` (or `type:id#relation`) for users. */
const RefSchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[a-z][a-z0-9_-]*:[^\s#@]+(#[a-z_]+)?$/i, "expected type:id");

const RelationNameSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/i, "expected a relation name");

export const CheckTupleSchema = z.object({
  user: RefSchema,
  relation: RelationNameSchema,
  object: RefSchema,
});
export type CheckTuple = z.infer<typeof CheckTupleSchema>;

export const ExplainRequestSchema = CheckTupleSchema.extend({
  includeProvenance: z.boolean().default(true),
});
export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;
export type ExplainRequestInput = z.input<typeof ExplainRequestSchema>;

export const ExplainResultSchema = z.enum(["allowed", "denied"]);
export type ExplainResult = z.infer<typeof ExplainResultSchema>;

/** How a node was reached in the model rewrite. */
export const ExplainViaSchema = z.enum(["union", "direct", "computed", "tupleToUserset"]);
export type ExplainVia = z.infer<typeof ExplainViaSchema>;

export interface ExplainNode {
  node: string;
  result: ExplainResult;
  via: ExplainVia;
  children?: ExplainNode[];
  /** provenance, present on direct leaves that matched a stored tuple */
  tupleId?: string;
  writtenAt?: string;
  writtenBy?: string;
  auditEventId?: string;
  /** resolution stopped here because the depth cap was hit */
  truncated?: boolean;
}

export const ExplainNodeSchema: z.ZodType<ExplainNode> = z.lazy(() =>
  z.object({
    node: z.string(),
    result: ExplainResultSchema,
    via: ExplainViaSchema,
    children: z.array(ExplainNodeSchema).optional(),
    tupleId: z.string().optional(),
    writtenAt: z.string().optional(),
    writtenBy: z.string().optional(),
    auditEventId: z.string().optional(),
    truncated: z.boolean().optional(),
  }),
);

export const DecisiveTupleSchema = z.object({
  /** the leaf node id, e.g. "folder:finance#editor@user:raj" */
  node: z.string(),
  tupleId: z.string(),
  writtenAt: z.string(),
  writtenBy: z.string(),
  auditEventId: z.string(),
});
export type DecisiveTuple = z.infer<typeof DecisiveTupleSchema>;

export const ExplainStatsSchema = z.object({
  nodesEvaluated: z.number().int().nonnegative(),
  maxDepth: z.number().int().nonnegative(),
  depthCap: z.number().int().positive(),
  depthCapHit: z.boolean(),
  fgaCalls: z.number().int().nonnegative(),
});
export type ExplainStats = z.infer<typeof ExplainStatsSchema>;

export const ExplainResponseSchema = z.object({
  allowed: z.boolean(),
  checkedAt: z.string(),
  durationMs: z.number().nonnegative(),
  cached: z.boolean(),
  consistency: ConsistencySchema,
  modelVersion: z.number().int().nonnegative(),
  tree: ExplainNodeSchema,
  /** null when denied: there is no tuple to attribute */
  decisive: DecisiveTupleSchema.nullable(),
  /** plain-language sentence for the decisive-tuple card */
  reason: z.string(),
  stats: ExplainStatsSchema,
});
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;

export const BatchCheckRequestSchema = z.object({
  checks: z.array(CheckTupleSchema).min(1).max(100),
});
export type BatchCheckRequest = z.infer<typeof BatchCheckRequestSchema>;

export const BatchCheckResultSchema = CheckTupleSchema.extend({
  allowed: z.boolean(),
  durationMs: z.number().nonnegative(),
});
export type BatchCheckResult = z.infer<typeof BatchCheckResultSchema>;

export const BatchCheckResponseSchema = z.object({
  checkedAt: z.string(),
  consistency: ConsistencySchema,
  modelVersion: z.number().int().nonnegative(),
  results: z.array(BatchCheckResultSchema),
});
export type BatchCheckResponse = z.infer<typeof BatchCheckResponseSchema>;

/** What the tenant select needs: slug, name, model version and the relations the model defines. */
export const PlaygroundTenantSchema = z.object({
  slug: z.string(),
  displayName: z.string(),
  modelVersion: z.number().int().nonnegative(),
  relations: z.array(z.string()).min(1),
});
export type PlaygroundTenant = z.infer<typeof PlaygroundTenantSchema>;
