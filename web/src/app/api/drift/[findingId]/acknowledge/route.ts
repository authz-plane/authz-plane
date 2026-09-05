import type { NextRequest } from "next/server";
import { acknowledgeFinding } from "@/features/drift/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST /api/drift/{findingId}/acknowledge → the acknowledged finding. Maps to
 * POST /v1/tenants/{id}/drift/{id}:acknowledge; suppresses that exact field
 * path until the desired value changes. Requires a session, same Origin and
 * an Idempotency-Key (guardRoute).
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/drift/[findingId]/acknowledge">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { findingId } = await ctx.params;
  const finding = await acknowledgeFinding(findingId);
  if (!finding) return problem(404, "Drift finding not found", `No drift finding ${findingId}.`);

  return Response.json(finding, { headers: { "cache-control": "no-store" } });
}
