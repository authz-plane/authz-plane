import type { NextRequest } from "next/server";
import { auditFilterFromSearch } from "@/features/audit/schemas";
import { listAuditEvents } from "@/features/audit/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug}/audit-events?actor=&action=&cursor= — one page of the tenant's append-only stream. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/tenants/[slug]/audit-events">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { slug } = await ctx.params;
  const { actor, action } = auditFilterFromSearch(request.nextUrl.searchParams);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const page = await listAuditEvents({ tenant: slug, ...(actor ? { actor } : {}), ...(action ? { action } : {}) }, cursor);
  if (!page) return problem(404, "Tenant not found", `No tenant ${slug}.`);

  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
