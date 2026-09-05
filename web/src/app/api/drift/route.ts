import type { NextRequest } from "next/server";
import { driftFilterFromSearch } from "@/features/drift/schemas";
import { listDrift } from "@/features/drift/server";
import { guardRoute } from "@/server/http/guard";

/** GET /api/drift?tenant=&severity= — the platform-wide open findings list (screen 10). */
export async function GET(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const filter = driftFilterFromSearch(request.nextUrl.searchParams);
  return Response.json(await listDrift(filter), { headers: { "cache-control": "no-store" } });
}
