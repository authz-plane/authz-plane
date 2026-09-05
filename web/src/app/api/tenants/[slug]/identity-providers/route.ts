import type { NextRequest } from "next/server";
import { listIdentityProviders } from "@/features/identity-providers/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET: the spec's identity-provider connections. Never carries a client secret. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/identity-providers">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const list = await listIdentityProviders(slug);
  if (!list) return problem(404, "Tenant not found");
  return Response.json(list, { headers: { "cache-control": "no-store" } });
}
