import type { NextRequest } from "next/server";
import { getDriftFinding } from "@/features/drift/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/drift/{findingId} — one finding for the drawer (screen 11); acknowledged findings stay addressable. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/drift/[findingId]">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { findingId } = await ctx.params;
  const finding = await getDriftFinding(findingId);
  if (!finding) return problem(404, "Drift finding not found", `No drift finding ${findingId}.`);

  return Response.json(finding, { headers: { "cache-control": "no-store" } });
}
