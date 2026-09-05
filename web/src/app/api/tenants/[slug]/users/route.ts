import type { NextRequest } from "next/server";
import { parseUsersFilter } from "@/features/users/schemas";
import { listUsers } from "@/features/users/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET: one cursor page of the user mirror. `q` matches email, subject or name; `cursor` continues a page. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/users">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const params = request.nextUrl.searchParams;
  const filter = parseUsersFilter({ q: params.get("q") ?? undefined });
  const cursor = params.get("cursor") ?? undefined;
  const page = await listUsers(slug, filter, cursor);
  if (!page) return problem(404, "Tenant not found");
  return Response.json(page, { headers: { "cache-control": "no-store" } });
}
