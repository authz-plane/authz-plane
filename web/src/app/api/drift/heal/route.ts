import type { NextRequest } from "next/server";
import { HealRequestSchema } from "@/features/drift/schemas";
import { healFindings } from "@/features/drift/server";
import { guardRoute, parseBody } from "@/server/http/guard";

/**
 * POST /api/drift/heal { findingIds } → 202 { runs: [{ tenant, runId }] }.
 * Bulk heal enqueues one reconcile per affected tenant (handoff "Mutations");
 * the fixture store drops the findings immediately, the real API closes them
 * on convergence.
 */
export async function POST(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const body = await parseBody(request, (input) => HealRequestSchema.safeParse(input));
  if (!body.ok) return body.response;

  const result = await healFindings(body.data.findingIds);
  return Response.json(result, { status: 202, headers: { "cache-control": "no-store" } });
}
