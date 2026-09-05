import type { NextRequest } from "next/server";
import { ValidateRequestSchema } from "@/features/spec/schemas";
import { validateSpec } from "@/features/spec/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** POST /api/tenants/{slug}/spec/validate → schema, indentation, secrets and SSRF results. Pure; no side effects. */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/spec/validate">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const body = await parseBody(request, (input) => ValidateRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const { slug } = await context.params;
  const result = await validateSpec(slug, body.data.body);
  if (!result) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
