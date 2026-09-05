import type { NextRequest } from "next/server";
import { fromUrlSearchParams, runFilterFromParams } from "@/features/reconcile/filter";
import { listRuns } from "@/features/reconcile/server";
import { findTenant } from "@/features/tenants/fixtures";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug}/reconcile-runs — the tenant-scoped list; the tenant filter is fixed by the path. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tenants/[slug]/reconcile-runs">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { slug } = await ctx.params;
  if (!findTenant(slug)) return problem(404, "Tenant not found", `No tenant ${slug}.`);

  const parsed = runFilterFromParams(fromUrlSearchParams(request.nextUrl.searchParams), { tenant: slug });
  if (!parsed.ok) return problem(400, "Invalid filter", parsed.message);

  return Response.json(await listRuns(parsed.filter), { headers: { "cache-control": "no-store" } });
}
