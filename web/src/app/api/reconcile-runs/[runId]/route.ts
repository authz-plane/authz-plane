import type { NextRequest } from "next/server";
import { getRun } from "@/features/reconcile/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/reconcile-runs/{runId} — polled at 1s by screen 09 while the run is in flight. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/reconcile-runs/[runId]">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { runId } = await ctx.params;
  const run = await getRun(runId);
  if (!run) return problem(404, "Run not found", `No reconcile run ${runId}.`);

  return Response.json(run, { headers: { "cache-control": "no-store" } });
}
