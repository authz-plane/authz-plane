import type { NextRequest } from "next/server";
import { ConsistencySchema, ExplainRequestSchema } from "@/features/playground/schemas";
import { explainForTenant } from "@/features/playground/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST: explain one check (system design §9.1). `?consistency=strong` bypasses
 * the decision cache; anything else is eventual. Explain is a read, but it
 * goes through the mutation guard so it carries an Idempotency-Key like every
 * other non-GET.
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/explain">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const consistency = ConsistencySchema.safeParse(request.nextUrl.searchParams.get("consistency") ?? "eventual");
  if (!consistency.success) return problem(400, "Invalid consistency", "consistency must be strong or eventual.");
  const body = await parseBody(request, (input) => ExplainRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const result = await explainForTenant(slug, body.data, consistency.data);
  if (!result) return problem(404, "Tenant not found");
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
