import type { NextRequest } from "next/server";
import { fromUrlSearchParams, runFilterFromParams } from "@/features/reconcile/filter";
import { listRuns } from "@/features/reconcile/server";
import { guardRoute } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/** GET /api/reconcile-runs?trigger=&outcome=&tenant=&cursor= — polled by screen 08. */
export async function GET(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const parsed = runFilterFromParams(fromUrlSearchParams(request.nextUrl.searchParams));
  if (!parsed.ok) return problem(400, "Invalid filter", parsed.message);

  return Response.json(await listRuns(parsed.filter), { headers: { "cache-control": "no-store" } });
}
