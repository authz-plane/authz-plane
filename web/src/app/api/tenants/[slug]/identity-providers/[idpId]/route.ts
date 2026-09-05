import type { NextRequest } from "next/server";
import { IdpPatchSchema } from "@/features/identity-providers/schemas";
import { getIdentityProvider, stageIdentityProvider } from "@/features/identity-providers/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

type Ctx = RouteContext<"/api/tenants/[slug]/identity-providers/[idpId]">;

/** GET: one connection. */
export async function GET(request: NextRequest, context: Ctx) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug, idpId } = await context.params;
  const result = await getIdentityProvider(slug, idpId);
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { headers: { "cache-control": "no-store" } });
}

/**
 * PATCH: stage an edit into the next generation. 202 with the generation it
 * lands in. The body may carry `clientSecret`; the response never does.
 */
export async function PATCH(request: NextRequest, context: Ctx) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug, idpId } = await context.params;
  const body = await parseBody(request, (input) => IdpPatchSchema.safeParse(input));
  if (!body.ok) return body.response;
  const result = await stageIdentityProvider(slug, idpId, body.data, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202 });
}
