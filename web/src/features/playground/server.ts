import "server-only";

import { findTenant, tenantDetailFixture } from "@/features/tenants/fixtures";
import { modelFor, playgroundTenants, tuplesFor } from "./fixtures";
import { batchCheck, explain } from "./resolver";
import {
  BatchCheckResponseSchema,
  ExplainResponseSchema,
  PlaygroundTenantSchema,
  type BatchCheckRequest,
  type BatchCheckResponse,
  type Consistency,
  type ExplainRequest,
  type ExplainResponse,
  type PlaygroundTenant,
} from "./schemas";

/**
 * Server-side explain / batch-check. The page pre-runs the frame's query with
 * these; the route handlers call the same functions. Fixtures until the .NET
 * API exposes POST /v1/tenants/{id}/explain and /batch-check.
 */

/** Fixture clock: the console's "now". */
const NOW = "2026-09-04T10:15:00Z";

function tenantContext(slug: string) {
  const tenant = findTenant(slug);
  if (!tenant) return null;
  return {
    model: modelFor(slug),
    tuples: tuplesFor(slug),
    modelVersion: tenantDetailFixture(slug)?.modelVersion ?? 0,
  };
}

/** Options for the TENANT select: every canonical tenant with its model version and relation names. */
export async function listPlaygroundTenants(): Promise<PlaygroundTenant[]> {
  return playgroundTenants().map((t) => PlaygroundTenantSchema.parse(t));
}

/** null when the tenant does not exist (route answers 404). */
export async function explainForTenant(
  slug: string,
  request: ExplainRequest,
  consistency: Consistency,
): Promise<ExplainResponse | null> {
  const ctx = tenantContext(slug);
  if (!ctx) return null;
  return ExplainResponseSchema.parse(
    explain(ctx.model, ctx.tuples, request, {
      now: NOW,
      modelVersion: ctx.modelVersion,
      consistency,
      includeProvenance: request.includeProvenance,
    }),
  );
}

export async function batchCheckForTenant(
  slug: string,
  request: BatchCheckRequest,
  consistency: Consistency,
): Promise<BatchCheckResponse | null> {
  const ctx = tenantContext(slug);
  if (!ctx) return null;
  return BatchCheckResponseSchema.parse(
    batchCheck(ctx.model, ctx.tuples, request.checks, {
      now: NOW,
      modelVersion: ctx.modelVersion,
      consistency,
    }),
  );
}
