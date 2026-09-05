import type { NextRequest } from "next/server";
import { ProbeRequestSchema } from "@/features/identity-providers/schemas";
import { testIdentityProvider } from "@/features/identity-providers/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST: run the SSRF-guarded discovery probe against an issuer. A blocked
 * issuer is a 200 with `ok: false` (the probe ran and has a result); only
 * malformed input or an unknown connection is a problem response.
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/identity-providers/[idpId]/test">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug, idpId } = await context.params;
  const body = await parseBody(request, (input) => ProbeRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const result = await testIdentityProvider(slug, idpId, body.data);
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { headers: { "cache-control": "no-store" } });
}
