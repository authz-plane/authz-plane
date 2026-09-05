import type { NextRequest } from "next/server";
import { WriteRequestSchema } from "@/features/relations/schemas";
import { writeRelations } from "@/features/relations/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST: atomic writes + deletes. 400 problem for `platform:*` objects or
 * relations the tenant's model does not define; otherwise applies and returns
 * {written, deleted, invalidatedDecisions}.
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/relations/write">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const body = await parseBody(request, (input) => WriteRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const { slug } = await context.params;
  const result = await writeRelations(slug, body.data, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data);
}
