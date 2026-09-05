import type { NextRequest } from "next/server";
import { listRoles } from "@/features/roles/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET: the spec's role projection with bound-tuple counts. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/roles">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const roles = await listRoles(slug);
  if (!roles) return problem(404, "Tenant not found");
  return Response.json(roles, { headers: { "cache-control": "no-store" } });
}
