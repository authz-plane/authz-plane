import type { NextRequest } from "next/server";
import { ValidateRequestSchema } from "@/features/authz-model/schemas";
import { validateModel } from "@/features/authz-model/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** POST: parse the DSL, count types/relations/depth, report unknown references. Pure; no side effects. */
export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/tenants/[slug]/authorization-model/validate">,
) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const body = await parseBody(request, (input) => ValidateRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const { slug } = await context.params;
  const result = await validateModel(slug, body.data.dsl);
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data);
}
