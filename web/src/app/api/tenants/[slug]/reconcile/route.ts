import type { NextRequest } from "next/server";
import { PlanRequestSchema } from "@/features/spec/schemas";
import { planSpec, reconcileNow } from "@/features/spec/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * POST /api/tenants/{slug}/reconcile
 *   ?dryRun=true → 200 Plan (pure planner; optional body { body } plans a draft)
 *   otherwise    → 202 { runId }
 * Both require a session, same Origin and an Idempotency-Key (guardRoute).
 */
export async function POST(request: NextRequest, context: RouteContext<"/api/tenants/[slug]/reconcile">) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;
  const { slug } = await context.params;

  if (request.nextUrl.searchParams.get("dryRun") === "true") {
    // The body is optional; an empty or absent body plans the current generation.
    const raw = await request.text();
    let draft: string | undefined;
    if (raw.trim()) {
      let json: unknown;
      try {
        json = JSON.parse(raw);
      } catch {
        return problem(400, "Invalid JSON body");
      }
      const parsed = PlanRequestSchema.safeParse(json);
      if (!parsed.success) return problem(400, "Validation failed", parsed.error.message);
      draft = parsed.data.body;
    }
    const plan = await planSpec(slug, draft, new Date());
    if (!plan) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);
    return Response.json(plan, { headers: { "cache-control": "no-store" } });
  }

  const accepted = await reconcileNow(slug, g.idempotencyKey ?? "", new Date());
  if (!accepted) return problem(404, "Tenant not found", `No tenant with slug "${slug}".`);
  return Response.json(accepted, { status: 202, headers: { "cache-control": "no-store" } });
}
