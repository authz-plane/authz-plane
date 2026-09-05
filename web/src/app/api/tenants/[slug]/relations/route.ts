import type { NextRequest } from "next/server";
import { PAGE_SIZE, parseRelationsFilter } from "@/features/relations/schemas";
import { listRelations } from "@/features/relations/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET: one cursor page of tuples. Filters user/relation/object are exact or `prefix*`. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/relations">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const sp = request.nextUrl.searchParams;
  const filter = parseRelationsFilter(Object.fromEntries(sp.entries()));
  const cursor = sp.get("cursor") ?? undefined;
  const limitRaw = sp.get("limit");
  const limit = limitRaw ? Number(limitRaw) : PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return problem(400, "Invalid limit", "Expected an integer between 1 and 100.");
  const page = await listRelations(slug, filter, cursor, limit);
  if (!page) return problem(404, "Tenant not found");
  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
