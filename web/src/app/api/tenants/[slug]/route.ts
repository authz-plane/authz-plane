import type { NextRequest } from "next/server";
import { getTenant } from "@/features/tenants/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug} → the tenant detail projection (screen 04 polls this). */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { slug } = await context.params;
  const tenant = await getTenant(slug);
  if (!tenant) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);

  return Response.json(tenant, { headers: { "cache-control": "no-store" } });
}
