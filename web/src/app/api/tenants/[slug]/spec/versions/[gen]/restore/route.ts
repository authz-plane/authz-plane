import type { NextRequest } from "next/server";
import { restoreVersion } from "@/features/spec/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST /api/tenants/{slug}/spec/versions/{gen}/restore → 202 { generation, runId }.
 * Writes the old body as a new generation; history is never mutated.
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/spec/versions/[gen]/restore">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug, gen } = await context.params;
  const generation = Number(gen);
  if (!Number.isInteger(generation) || generation < 1) return problem(400, "Invalid generation", `"${gen}" is not a generation number.`);

  const result = await restoreVersion(slug, generation, g.idempotencyKey ?? "", g.operator.email, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202, headers: { "cache-control": "no-store" } });
}
