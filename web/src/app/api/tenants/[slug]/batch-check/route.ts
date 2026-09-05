import type { NextRequest } from "next/server";
import { BatchCheckRequestSchema, ConsistencySchema } from "@/features/playground/schemas";
import { batchCheckForTenant } from "@/features/playground/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** POST: up to 100 checks, allowed/denied per row, no trees. */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/batch-check">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const consistency = ConsistencySchema.safeParse(request.nextUrl.searchParams.get("consistency") ?? "eventual");
  if (!consistency.success) return problem(400, "Invalid consistency", "consistency must be strong or eventual.");
  const body = await parseBody(request, (input) => BatchCheckRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const result = await batchCheckForTenant(slug, body.data, consistency.data);
  if (!result) return problem(404, "Tenant not found");
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
