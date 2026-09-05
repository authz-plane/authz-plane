import { z } from "zod";

/**
 * Wire shapes for /api/tenants/[slug]/relations. Tuples are (user, relation,
 * object) triples validated against the tenant's live model; `platform:*` is a
 * reserved object namespace the control plane keeps for itself.
 */

/** "type:id" or "type:id#relation" (userset). */
const ObjectRef = z.string().min(3).regex(/^[a-z][\w-]*:\S+$/, "expected type:id");
const RelationName = z.string().min(1).regex(/^[a-z][\w]*$/, "expected a relation name");

export const TupleSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("spec"), generation: z.number().int().positive() }),
  z.object({ kind: z.literal("api") }),
  /** present in the store but absent from desired state */
  z.object({ kind: z.literal("drift") }),
]);
export type TupleSource = z.infer<typeof TupleSourceSchema>;

export const TupleSchema = z.object({
  id: z.string(),
  user: z.string(),
  relation: z.string(),
  object: z.string(),
  source: TupleSourceSchema,
  writtenAt: z.string(),
});
export type Tuple = z.infer<typeof TupleSchema>;

export const TupleInputSchema = z.object({
  user: ObjectRef,
  relation: RelationName,
  object: ObjectRef,
});
export type TupleInput = z.infer<typeof TupleInputSchema>;

/** Filters live in the URL. Exact match, or a trailing `*` for a prefix (e.g. `folder:*`). */
export const RelationsFilterSchema = z.object({
  user: z.string().min(1).optional(),
  relation: z.string().min(1).optional(),
  object: z.string().min(1).optional(),
});
export type RelationsFilter = z.infer<typeof RelationsFilterSchema>;

/** Normalise raw search params into a filter with no empty keys, so query keys compare equal. */
export function parseRelationsFilter(params: Record<string, string | string[] | undefined>): RelationsFilter {
  const pick = (k: keyof RelationsFilter) => {
    const v = params[k];
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : undefined;
  };
  const out: RelationsFilter = {};
  const user = pick("user");
  const relation = pick("relation");
  const object = pick("object");
  if (user) out.user = user;
  if (relation) out.relation = relation;
  if (object) out.object = object;
  return RelationsFilterSchema.parse(out);
}

export const PAGE_SIZE = 6;

export const RelationsPageSchema = z.object({
  items: z.array(TupleSchema),
  nextCursor: z.string().nullable(),
  /** total matching tuples (the whole store when unfiltered) */
  total: z.number().int().nonnegative(),
  modelVersion: z.number().int().positive(),
  /** decisions cached under this model-version tag; a write invalidates them */
  cachedDecisions: z.number().int().nonnegative(),
});
export type RelationsPage = z.infer<typeof RelationsPageSchema>;

export const WriteRequestSchema = z
  .object({
    writes: z.array(TupleInputSchema).max(100),
    deletes: z.array(TupleInputSchema).max(100),
  })
  .refine((r) => r.writes.length + r.deletes.length > 0, { message: "nothing staged" });
export type WriteRequest = z.infer<typeof WriteRequestSchema>;

export const WriteResultSchema = z.object({
  written: z.number().int().nonnegative(),
  deleted: z.number().int().nonnegative(),
  invalidatedDecisions: z.number().int().nonnegative(),
  modelVersion: z.number().int().positive(),
});
export type WriteResult = z.infer<typeof WriteResultSchema>;
