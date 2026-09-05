import type { NextRequest } from "next/server";
import { InviteRequestSchema } from "@/features/users/schemas";
import { inviteUser } from "@/features/users/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** POST: invite a user through the IdP. 202; the mirror shows them after the next resync. */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/users/invite">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const body = await parseBody(request, (input) => InviteRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const result = await inviteUser(slug, body.data, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202 });
}
