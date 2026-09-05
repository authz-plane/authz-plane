import type { NextRequest } from "next/server";
import { isSlugAvailable } from "@/features/tenants/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * GET /api/tenants/slug-check?slug=vertex-freight → { available, reason? }.
 * The new-tenant form calls this debounced while the operator types.
 */
export async function GET(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const slug = request.nextUrl.searchParams.get("slug");
  if (slug === null) return problem(400, "Missing slug", "Pass ?slug=<candidate>.");

  const result = await isSlugAvailable(slug.trim());
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
