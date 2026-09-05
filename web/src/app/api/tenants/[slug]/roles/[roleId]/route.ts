import type { NextRequest } from "next/server";
import { deleteRole } from "@/features/roles/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** DELETE: 409 problem while tuples bind to the role; 202 once the removal is staged. */
export async function DELETE(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/roles/[roleId]">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug, roleId } = await context.params;
  const result = await deleteRole(slug, roleId, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202 });
}
