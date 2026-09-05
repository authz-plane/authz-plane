import { z } from "zod";

/**
 * Wire shapes for the drift screens (10, 11). The .NET API has no drift
 * endpoints yet; these are the contract the fixtures and the UI agree on and
 * the server side maps real responses into once GET /v1/drift lands.
 */

export const SeveritySchema = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;
export const SEVERITIES = SeveritySchema.options;

export const DriftStatusSchema = z.enum(["open", "acknowledged"]);
export type DriftStatus = z.infer<typeof DriftStatusSchema>;

export const DriftFindingSchema = z.object({
  /** short opaque id, e.g. "9c1f7e2a"; routes as /drift/{id} */
  id: z.string().min(1),
  tenant: z.string().min(1),
  /** copied from the tenant so the action column can swap to "view reconcile" */
  autoHeal: z.boolean(),
  resource: z.object({
    /** "zitadel.idp", "fga.tuple", "zitadel.org", "fga.model", "zitadel.user" */
    kind: z.string().min(1),
    /** mono field path or tuple, e.g. "claimMappings.email" */
    path: z.string().min(1),
    /** provenance reference, e.g. "zitadel.idp/globex-okta" */
    ref: z.string().min(1),
  }),
  /** null renders as "absent" */
  desired: z.string().nullable(),
  actual: z.string().nullable(),
  severity: SeveritySchema,
  status: DriftStatusSchema,
  detectedAt: z.string(),
  /** short run id of the resync that produced the finding */
  detectedByRun: z.string().min(1),
  /** drawer title, e.g. "claimMappings.email changed out-of-band" */
  title: z.string().min(1),
  impact: z.string().min(1),
  evidence: z.object({
    actualStateHash: z.string().min(1),
    lastKnownHash: z.string().min(1),
    siblingFindings: z.number().int().positive(),
    conclusion: z.string().min(1),
  }),
  healPlan: z.object({
    resource: z.string().min(1),
    description: z.string().min(1),
    changeKey: z.string().min(1),
  }),
  /** the reconcile that will (or did) close this finding when autoHeal is on */
  reconcileRunId: z.string().nullable(),
});
export type DriftFinding = z.infer<typeof DriftFindingSchema>;

export const DriftListFilterSchema = z.object({
  tenant: z.string().min(1).optional(),
  severity: SeveritySchema.optional(),
});
export type DriftListFilter = z.infer<typeof DriftListFilterSchema>;

export const DriftStatsSchema = z.object({
  open: z.number().int().nonnegative(),
  tenantsAffected: z.number().int().nonnegative(),
  /** null when nothing is open */
  oldestUnresolvedSeconds: z.number().int().nonnegative().nullable(),
  healedToday: z.number().int().nonnegative(),
});
export type DriftStats = z.infer<typeof DriftStatsSchema>;

export const DriftListSchema = z.object({
  generatedAt: z.string(),
  items: z.array(DriftFindingSchema),
  /** unfiltered stats for the scope (platform or one tenant) */
  stats: DriftStatsSchema,
  lastResyncAt: z.string(),
  resyncIntervalSeconds: z.number().int().positive(),
  /** tenant slugs with open findings, for the filter select */
  tenants: z.array(z.string()),
});
export type DriftList = z.infer<typeof DriftListSchema>;

export const HealRequestSchema = z.object({
  findingIds: z.array(z.string().min(1)).min(1),
});
export type HealRequest = z.infer<typeof HealRequestSchema>;

export const HealResponseSchema = z.object({
  runs: z.array(z.object({ tenant: z.string(), runId: z.string() })),
});
export type HealResponse = z.infer<typeof HealResponseSchema>;

export const ResyncResponseSchema = z.object({
  status: z.literal("accepted"),
  scheduledAt: z.string(),
});
export type ResyncResponse = z.infer<typeof ResyncResponseSchema>;

/** Parse ?tenant=&severity= from a URLSearchParams-like record; invalid values are dropped, never thrown. */
export function driftFilterFromSearch(
  params: Record<string, string | string[] | undefined> | URLSearchParams,
): DriftListFilter {
  const get = (k: string) => {
    const v = params instanceof URLSearchParams ? params.get(k) : params[k];
    return typeof v === "string" && v.length > 0 ? v : undefined;
  };
  const tenant = get("tenant");
  const severity = SeveritySchema.safeParse(get("severity"));
  return {
    ...(tenant ? { tenant } : {}),
    ...(severity.success ? { severity: severity.data } : {}),
  };
}
