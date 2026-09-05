import { describe, expect, it } from "vitest";
import { problem, sameOrigin } from "./problem";

describe("problem", () => {
  it("emits RFC 9457 problem+json", async () => {
    const res = problem(412, "Precondition failed", "spec changed underneath you");
    expect(res.status).toBe(412);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
    await expect(res.json()).resolves.toEqual({
      type: "about:blank",
      title: "Precondition failed",
      status: 412,
      detail: "spec changed underneath you",
    });
  });

  it("omits detail when absent and merges extension members", async () => {
    const body = await problem(409, "Conflict", undefined, { boundTuples: 14 }).json();
    expect(body).toEqual({ type: "about:blank", title: "Conflict", status: 409, boundTuples: 14 });
  });
});

describe("sameOrigin", () => {
  const url = "http://localhost:3000/api/auth/logout";

  it("accepts a matching Origin", () => {
    expect(sameOrigin(new Request(url, { headers: { origin: "http://localhost:3000" } }))).toBe(true);
  });

  it("rejects a missing or foreign Origin", () => {
    expect(sameOrigin(new Request(url))).toBe(false);
    expect(sameOrigin(new Request(url, { headers: { origin: "https://evil.example" } }))).toBe(false);
    expect(sameOrigin(new Request(url, { headers: { origin: "http://localhost:3001" } }))).toBe(false);
  });
});
