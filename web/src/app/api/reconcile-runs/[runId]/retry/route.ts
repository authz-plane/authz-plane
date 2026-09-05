import type { NextRequest } from "next/server";
import { retryRun } from "@/features/reconcile/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST /api/reconcile-runs/{runId}/retry → 202 { runId }. Requires a session,
 * same Origin and an Idempotency-Key (guardRoute); replaying the key returns
 * the run the first call created.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/reconcile-runs/[runId]/retry">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { runId } = await ctx.params;
  const result = await retryRun(runId, g.idempotencyKey ?? "");
  if (!result.ok) return problem(result.status, result.title, result.detail);

  return Response.json({ runId: result.runId }, { status: 202, headers: { "cache-control": "no-store" } });
}
