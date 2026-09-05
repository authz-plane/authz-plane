import type { NextRequest } from "next/server";
import { SaveSpecRequestSchema } from "@/features/spec/schemas";
import { getSpec, saveSpec } from "@/features/spec/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/tenants/{slug}/spec → the current desired-state document. */
export async function GET(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/spec">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;
  const spec = await getSpec(slug);
  if (!spec) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);
  return Response.json(spec, { headers: { "cache-control": "no-store", etag: `"${spec.generation}"` } });
}

/**
 * PUT /api/tenants/{slug}/spec with `If-Match: <generation>` → 202
 * { generation, runId }. 428 without If-Match, 412 when stale, 400 when the
 * body fails validation. Requires session, same Origin and Idempotency-Key.
 */
export async function PUT(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/spec">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const body = await parseBody(request, (input) => SaveSpecRequestSchema.safeParse(input));
  if (!body.ok) return body.response;
  const { slug } = await context.params;

  const header = request.headers.get("if-match");
  const ifMatch = header === null ? null : Number(header.replace(/"/g, "").trim());
  if (ifMatch !== null && !Number.isInteger(ifMatch)) {
    return problem(400, "Invalid If-Match", "If-Match must carry the generation number you edited.");
  }

  const result = await saveSpec(slug, body.data.body, ifMatch, g.idempotencyKey ?? "", g.operator.email, new Date());
  if (!result.ok) return problem(result.status, result.title, result.detail);
  return Response.json(result.data, { status: 202, headers: { "cache-control": "no-store" } });
}
