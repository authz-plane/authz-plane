import type { NextRequest } from "next/server";
import { refreshUsers } from "@/features/users/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** POST: enqueue a resync of the mirror from the IdP. 202 with the run id. */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/users/refresh">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const result = await refreshUsers(slug, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202 });
}
