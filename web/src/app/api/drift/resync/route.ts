import type { NextRequest } from "next/server";
import { resyncAll } from "@/features/drift/server";
import { guardRoute } from "@/server/http/guard";

/** POST /api/drift/resync → 202 { status: "accepted", scheduledAt }. Enqueues a fleet-wide resync. */
export async function POST(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  return Response.json(await resyncAll(new Date()), { status: 202, headers: { "cache-control": "no-store" } });
}
