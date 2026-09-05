import type { NextRequest } from "next/server";
import { requestAuditExport } from "@/features/audit/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST /api/tenants/{slug}/audit-exports → 202 { exportId, status: "queued", format }.
 * Requires a session, same Origin and an Idempotency-Key (guardRoute);
 * replaying the key returns the export the first call queued.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/tenants/[slug]/audit-exports">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const { slug } = await ctx.params;
  const result = await requestAuditExport(slug, g.idempotencyKey ?? "");
  if (!result) return problem(404, "Tenant not found", `No tenant ${slug}.`);

  return Response.json(result, { status: 202, headers: { "cache-control": "no-store" } });
}
