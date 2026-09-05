import { describe, expect, it } from "vitest";
import {
  hasActiveFilters,
  parseTenantListFilter,
  searchParamsFrom,
  tenantListApiPath,
  tenantListFilterFromParams,
  tenantListHref,
  tenantListSearch,
} from "./filters";

describe("tenant list filters from the URL", () => {
  it("parses phase, drift, q and cursor", () => {
    const filter = tenantListFilterFromParams(new URLSearchParams("phase=Ready&drift=1&q=%20acme%20&cursor=umbrella-health"));
    expect(filter).toEqual({ phase: "Ready", hasDrift: true, q: "acme", cursor: "umbrella-health", limit: 25 });
  });

  it("treats drift=true and drift=1 as on, anything else as off", () => {
    expect(tenantListFilterFromParams(new URLSearchParams("drift=true")).hasDrift).toBe(true);
    expect(tenantListFilterFromParams(new URLSearchParams("drift=0")).hasDrift).toBeUndefined();
    expect(tenantListFilterFromParams(new URLSearchParams("")).hasDrift).toBeUndefined();
  });

  it("strict parse rejects an unknown phase with a helpful message", () => {
    const result = parseTenantListFilter(new URLSearchParams("phase=Broken"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain('Unknown phase "Broken"');
  });

  it("lenient parse drops the bad phase but keeps the rest", () => {
    expect(tenantListFilterFromParams(new URLSearchParams("phase=Broken&q=acme"))).toEqual({ q: "acme", limit: 25 });
  });

  it("flattens Next's searchParams record, first value wins", () => {
    const params = searchParamsFrom({ phase: ["Failed", "Ready"], q: "rail", missing: undefined });
    expect(params.get("phase")).toBe("Failed");
    expect(params.get("q")).toBe("rail");
    expect(params.has("missing")).toBe(false);
  });
});

describe("tenant list hrefs", () => {
  const filter = { phase: "Ready" as const, hasDrift: true, q: "acme", cursor: "globex-logistics", limit: 25 };

  it("round-trips through the query string without the default limit", () => {
    expect(tenantListSearch(filter)).toBe("?phase=Ready&drift=1&q=acme&cursor=globex-logistics");
    expect(tenantListSearch({ limit: 25 })).toBe("");
    expect(tenantListFilterFromParams(new URLSearchParams(tenantListSearch(filter)))).toEqual(filter);
  });

  it("changing a filter resets the cursor; undefined clears a key", () => {
    expect(tenantListHref(filter, { phase: "Failed" })).toBe("/tenants?phase=Failed&drift=1&q=acme");
    expect(tenantListHref(filter, { phase: undefined })).toBe("/tenants?drift=1&q=acme");
    expect(tenantListHref(filter, { phase: undefined, hasDrift: undefined, q: undefined })).toBe("/tenants");
  });

  it("paging keeps the filters and only moves the cursor", () => {
    expect(tenantListHref(filter, { cursor: "wayne-transit" })).toBe("/tenants?phase=Ready&drift=1&q=acme&cursor=wayne-transit");
    expect(tenantListHref(filter, { cursor: undefined })).toBe("/tenants?phase=Ready&drift=1&q=acme");
  });

  it("the client polls the API path for the same filter", () => {
    expect(tenantListApiPath({ phase: "Applying", limit: 25 })).toBe("/api/tenants?phase=Applying");
    expect(tenantListApiPath({ limit: 25 })).toBe("/api/tenants");
  });

  it("knows when anything but paging is active", () => {
    expect(hasActiveFilters({ limit: 25 })).toBe(false);
    expect(hasActiveFilters({ cursor: "x", limit: 25 })).toBe(false);
    expect(hasActiveFilters({ q: "x", limit: 25 })).toBe(true);
  });
});
