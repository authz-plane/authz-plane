import { PhaseSchema, TenantListFilterSchema, type TenantListFilter } from "./schemas";

/**
 * Screen 03 keeps its filters and cursor in the URL so views are shareable
 * and the server prefetch agrees with the client query key. These helpers are
 * the single place that knows the parameter names.
 *
 *   /tenants?phase=Ready&drift=1&q=acme&cursor=<opaque>
 */
export const PAGE_SIZE = 25;

export const LIST_PATH = "/tenants";
export const LIST_API_PATH = "/api/tenants";

type Raw = Record<string, string | string[] | undefined>;

/** Next's `searchParams` record → URLSearchParams (first value wins). */
export function searchParamsFrom(raw: Raw): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === "string") params.set(key, first);
  }
  return params;
}

function truthy(value: string | null): boolean {
  return value === "1" || value === "true";
}

function shape(params: URLSearchParams) {
  const phase = params.get("phase");
  const q = params.get("q")?.trim();
  const cursor = params.get("cursor");
  return {
    ...(phase ? { phase } : {}),
    ...(truthy(params.get("drift")) ? { hasDrift: true } : {}),
    ...(q ? { q } : {}),
    ...(cursor ? { cursor } : {}),
    limit: PAGE_SIZE,
  };
}

/**
 * Strict parse for the API route: an unknown phase is a 400, not a silent
 * "show everything".
 */
export function parseTenantListFilter(
  params: URLSearchParams,
): { ok: true; filter: TenantListFilter } | { ok: false; message: string } {
  const result = TenantListFilterSchema.safeParse(shape(params));
  if (result.success) return { ok: true, filter: result.data };
  const phase = params.get("phase");
  const message =
    phase && !PhaseSchema.safeParse(phase).success
      ? `Unknown phase "${phase}". Expected one of ${PhaseSchema.options.join(", ")}.`
      : result.error.message;
  return { ok: false, message };
}

/** Lenient parse for the page: junk parameters are dropped and the list still renders. */
export function tenantListFilterFromParams(params: URLSearchParams): TenantListFilter {
  const strict = parseTenantListFilter(params);
  if (strict.ok) return strict.filter;
  const cleaned = new URLSearchParams(params);
  cleaned.delete("phase");
  const fallback = parseTenantListFilter(cleaned);
  return fallback.ok ? fallback.filter : TenantListFilterSchema.parse({ limit: PAGE_SIZE });
}

/** Query string (with leading "?", or "" when nothing is set). Never includes the default limit. */
export function tenantListSearch(filter: TenantListFilter): string {
  const params = new URLSearchParams();
  if (filter.phase) params.set("phase", filter.phase);
  if (filter.hasDrift) params.set("drift", "1");
  if (filter.q) params.set("q", filter.q);
  if (filter.cursor) params.set("cursor", filter.cursor);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

type Patch = Partial<Pick<TenantListFilter, "phase" | "hasDrift" | "q" | "cursor">>;

/**
 * Build a list URL from the current filter plus a patch. Passing `undefined`
 * for a key clears it. Changing anything other than the cursor resets the
 * cursor, since the old page boundary no longer means anything.
 */
export function tenantListHref(filter: TenantListFilter, patch: Patch = {}): string {
  const next: TenantListFilter = { ...filter, cursor: undefined, ...patch };
  for (const key of Object.keys(patch) as Array<keyof Patch>) {
    if (patch[key] === undefined) delete next[key];
  }
  if (!("cursor" in patch)) delete next.cursor;
  return `${LIST_PATH}${tenantListSearch(next)}`;
}

/** Path the client polls for this exact filter. */
export function tenantListApiPath(filter: TenantListFilter): string {
  return `${LIST_API_PATH}${tenantListSearch(filter)}`;
}

export function hasActiveFilters(filter: TenantListFilter): boolean {
  return Boolean(filter.phase || filter.hasDrift || filter.q);
}
