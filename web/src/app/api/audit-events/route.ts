import type { NextRequest } from "next/server";
import { auditFilterFromSearch } from "@/features/audit/schemas";
import { listAuditEvents } from "@/features/audit/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/audit-events?tenant=&actor=&action=&cursor= — the platform-wide stream for /audit. */
export async function GET(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const filter = auditFilterFromSearch(request.nextUrl.searchParams);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const page = await listAuditEvents(filter, cursor);
  if (!page) return problem(404, "Tenant not found", `No tenant ${filter.tenant}.`);

  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
