import { z } from "zod";
import { PhaseSchema } from "@/features/tenants/schemas";

/**
 * Wire shapes for the BFF's /api/dashboard route. The .NET API has no
 * endpoints yet, so these are the contract the fixtures and the UI agree on;
 * once the OpenAPI client is generated (system design §10) the server side
 * maps the real responses into this shape.
 */

export { PhaseSchema, type Phase } from "@/features/tenants/schemas";

export const WindowSchema = z.enum(["1h", "6h", "24h", "7d"]);
export type Window = z.infer<typeof WindowSchema>;
export const DEFAULT_WINDOW: Window = "24h";

export const WINDOW_LABELS: Record<Window, string> = {
  "1h": "Last hour",
  "6h": "Last 6h",
  "24h": "Last 24h",
  "7d": "Last 7 days",
};

export const OutcomeBucketSchema = z.object({
  startsAt: z.string(),
  ready: z.number().int().nonnegative(),
  degraded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type OutcomeBucket = z.infer<typeof OutcomeBucketSchema>;

export const AttentionKindSchema = z.enum([
  "failed",
  "degraded",
  "drift",
  "applying",
]);
export type AttentionKind = z.infer<typeof AttentionKindSchema>;

export const AttentionItemSchema = z.object({
  slug: z.string(),
  kind: AttentionKindSchema,
  /** chip text, e.g. "Failed", "Drift ×4" */
  label: z.string(),
  reason: z.string(),
  href: z.string(),
});
export type AttentionItem = z.infer<typeof AttentionItemSchema>;

export const DashboardOverviewSchema = z.object({
  generatedAt: z.string(),
  window: WindowSchema,
  tenants: z.object({
    total: z.number().int().nonnegative(),
    converged: z.number().int().nonnegative(),
    byPhase: z.record(PhaseSchema, z.number().int().nonnegative()),
  }),
  convergenceLag: z.object({
    p95Seconds: z.number().nonnegative(),
    sloSeconds: z.number().positive(),
  }),
  drift: z.object({
    open: z.number().int().nonnegative(),
    tenantsAffected: z.number().int().nonnegative(),
  }),
  outbox: z.object({
    depth: z.number().int().nonnegative(),
    lagSeconds: z.number().nonnegative(),
  }),
  outcomes: z.object({
    runs: z.number().int().nonnegative(),
    successRate: z.number().min(0).max(1),
    buckets: z.array(OutcomeBucketSchema).length(12),
  }),
  needsAttention: z.array(AttentionItemSchema),
});
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

export const DependencyStatusSchema = z.enum(["ok", "degraded", "down"]);
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

/** What the sidebar needs on every console page: nav counts + dependency health. */
export const ShellSummarySchema = z.object({
  nav: z.object({
    reconcileRuns: z.number().int().nonnegative(),
    drift: z.number().int().nonnegative(),
  }),
  dependencies: z.array(
    z.object({ name: z.string(), status: DependencyStatusSchema }),
  ),
});
export type ShellSummary = z.infer<typeof ShellSummarySchema>;
