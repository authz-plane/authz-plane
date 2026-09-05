import type { NextRequest } from "next/server";
import { StageRequestSchema } from "@/features/authz-model/schemas";
import { getAuthorizationModel, stageModel } from "@/features/authz-model/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET: live + draft DSL and version history. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/authorization-model">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const model = await getAuthorizationModel(slug);
  if (!model) return problem(404, "Tenant not found");
  return Response.json(model, { headers: { "cache-control": "no-store" } });
}

/** POST: stage the draft DSL into the next spec generation → 202. */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/authorization-model">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const body = await parseBody(request, (input) => StageRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const { slug } = await context.params;
  const result = await stageModel(slug, body.data.dsl, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202 });
}
