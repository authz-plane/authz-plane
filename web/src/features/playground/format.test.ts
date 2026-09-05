import { describe, expect, it } from "vitest";
import { batchCheckPath, checkedAtLabel, curlFor, explainPath, resultMeta } from "./format";

describe("playground format", () => {
  it("renders checkedAt as a UTC clock with seconds", () => {
    expect(checkedAtLabel("2026-09-04T10:15:00Z")).toBe("10:15:00Z");
    expect(checkedAtLabel("2026-09-04T23:05:09.500+02:00")).toBe("21:05:09Z");
    expect(checkedAtLabel("garbage")).toBe("garbage");
  });

  it("builds the frame's header meta", () => {
    expect(resultMeta({ durationMs: 7, cached: false, modelVersion: 6, checkedAt: "2026-09-04T10:15:00Z" })).toBe(
      "7ms · cache miss · model v6 · checkedAt 10:15:00Z",
    );
    expect(resultMeta({ durationMs: 2, cached: true, modelVersion: 3, checkedAt: "2026-09-04T10:15:00Z" })).toContain("cache hit");
  });

  it("adds ?consistency=strong only when strong is requested", () => {
    expect(explainPath("acme-air", "strong")).toBe("/api/tenants/acme-air/explain?consistency=strong");
    expect(explainPath("acme-air", "eventual")).toBe("/api/tenants/acme-air/explain");
    expect(batchCheckPath("acme air", "strong")).toBe("/api/tenants/acme%20air/batch-check?consistency=strong");
  });

  it("writes a curl for the public API with a token placeholder and the JSON body", () => {
    const curl = curlFor("acme-air", { user: "user:raj", relation: "viewer", object: "document:budget-2026" }, "strong");
    expect(curl).toContain('"$AUTHZ_PLANE_API/v1/tenants/acme-air/explain?consistency=strong"');
    expect(curl).toContain("Authorization: Bearer $AUTHZ_PLANE_TOKEN");
    expect(curl).toContain("Idempotency-Key: $(uuidgen)");
    expect(curl).toContain('"includeProvenance":true');
    expect(curl.split("\n")).toHaveLength(5);
    expect(curlFor("acme-air", { user: "user:raj", relation: "viewer", object: "document:budget-2026", includeProvenance: false }, "eventual")).toContain(
      '/explain"',
    );
  });
});
