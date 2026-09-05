import { RunListFilterSchema, type RunListFilter } from "./schemas";

/**
 * Parses list filters from either a page's `searchParams` record or a route's
 * URLSearchParams. Both sides call this so the server prefetch and the BFF
 * agree on what a filter means. Unknown values are an error, not a silent
 * "any": a shared link with a typo should say so.
 */
export function runFilterFromParams(
  get: (name: string) => string | undefined,
  fixed: Partial<Pick<RunListFilter, "tenant">> = {},
): { ok: true; filter: RunListFilter } | { ok: false; message: string } {
  const limitRaw = get("limit");
  const parsed = RunListFilterSchema.safeParse({
    trigger: get("trigger"),
    outcome: get("outcome"),
    tenant: fixed.tenant ?? get("tenant"),
    cursor: get("cursor"),
    ...(limitRaw !== undefined ? { limit: Number(limitRaw) } : {}),
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue ? `${issue.path.join(".")}: ${issue.message}` : "invalid filter" };
  }
  return { ok: true, filter: parsed.data };
}

/** Adapter for Next's `searchParams` record (string | string[] | undefined). */
export function fromSearchParamsRecord(params: Record<string, string | string[] | undefined>) {
  return (name: string): string | undefined => {
    const v = params[name];
    return typeof v === "string" && v !== "" ? v : undefined;
  };
}

/** Adapter for URLSearchParams; empty strings read as absent. */
export function fromUrlSearchParams(params: URLSearchParams) {
  return (name: string): string | undefined => {
    const v = params.get(name);
    return v === null || v === "" ? undefined : v;
  };
}
