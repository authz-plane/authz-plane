import type { NextRequest } from "next/server";
import { listVersions } from "@/features/spec/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug}/spec/versions → every generation, newest first, bodies included (refs only, never secrets). */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/spec/versions">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const versions = await listVersions(slug);
  if (!versions) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);
  return Response.json(versions, { headers: { "cache-control": "no-store" } });
}
