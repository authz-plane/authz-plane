import type { NextRequest } from "next/server";
import { driftFilterFromSearch } from "@/features/drift/schemas";
import { listDrift } from "@/features/drift/server";
import { findTenant } from "@/features/tenants/fixtures";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug}/drift?severity= — tenant-scoped open findings; the tenant is fixed by the path. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tenants/[slug]/drift">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { slug } = await ctx.params;
  if (!findTenant(slug)) return problem(404, "Tenant not found", `No tenant ${slug}.`);

  const { severity } = driftFilterFromSearch(request.nextUrl.searchParams);
  const filter = { tenant: slug, ...(severity ? { severity } : {}) };
  return Response.json(await listDrift(filter), { headers: { "cache-control": "no-store" } });
}
