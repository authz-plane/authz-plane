import type { NextRequest } from "next/server";
import { parseTenantListFilter } from "@/features/tenants/filters";
import { CreateTenantInputSchema } from "@/features/tenants/schemas";
import { createTenant, listTenants, SlugTakenError } from "@/features/tenants/server";
import { guardRoute, parseBody } from "@/server/http/guard";
import { problem } from "@/server/http/problem";

/**
 * GET /api/tenants?phase=&drift=1&q=&cursor= → one cursor page. Polled by
 * screen 03; an unknown phase is a 400 rather than a silent "everything".
 */
export async function GET(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const parsed = parseTenantListFilter(request.nextUrl.searchParams);
  if (!parsed.ok) return problem(400, "Invalid filter", parsed.message);

  const page = await listTenants(parsed.filter);
  return Response.json(page, { headers: { "cache-control": "no-store" } });
}

/**
 * POST /api/tenants → 201 with the new summary (generation 1, Pending). A slug
 * that is already held is a 409 problem; the form renders it inline.
 */
export async function POST(request: NextRequest) {
  const g = await guardRoute(request);
  if (!g.ok) return g.response;

  const body = await parseBody(request, (input) => CreateTenantInputSchema.safeParse(input));
  if (!body.ok) return body.response;

  try {
    const created = await createTenant(body.data, new Date());
    return Response.json(created, {
      status: 201,
      headers: { location: `/api/tenants/${created.slug}`, "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof SlugTakenError) return problem(error.status, error.title, error.message);
    throw error;
  }
}
