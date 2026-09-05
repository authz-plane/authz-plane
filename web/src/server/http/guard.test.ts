import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const currentOperator = vi.fn();
vi.mock("@/server/auth/operator", () => ({ currentOperator: () => currentOperator() }));

import { guardRoute, parseBody } from "./guard";

const OPERATOR = {
  sub: "user:test",
  name: "Test",
  email: "t@authz-plane.test",
  role: "platform superadmin",
  iat: 0,
  exp: 1,
};
const url = "http://localhost:3000/api/tenants/acme-air/reconcile";

describe("guardRoute", () => {
  beforeEach(() => currentOperator.mockReset());

  it("returns 401 problem without a session", async () => {
    currentOperator.mockResolvedValue(null);
    const g = await guardRoute(new Request(url));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(401);
  });

  it("lets a GET through with only a session", async () => {
    currentOperator.mockResolvedValue(OPERATOR);
    const g = await guardRoute(new Request(url));
    expect(g.ok).toBe(true);
    if (g.ok) expect(g.idempotencyKey).toBeNull();
  });

  it("rejects a cross-origin POST", async () => {
    currentOperator.mockResolvedValue(OPERATOR);
    const g = await guardRoute(new Request(url, { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(g.ok).toBe(false);
    if (!g.ok) expect(g.response.status).toBe(403);
  });

  it("requires an Idempotency-Key on mutations", async () => {
    currentOperator.mockResolvedValue(OPERATOR);
    const noKey = await guardRoute(new Request(url, { method: "POST", headers: { origin: "http://localhost:3000" } }));
    expect(noKey.ok).toBe(false);
    if (!noKey.ok) expect(noKey.response.status).toBe(400);

    const withKey = await guardRoute(
      new Request(url, {
        method: "POST",
        headers: { origin: "http://localhost:3000", "idempotency-key": "abc" },
      }),
    );
    expect(withKey.ok).toBe(true);
    if (withKey.ok) expect(withKey.idempotencyKey).toBe("abc");
  });
});

describe("parseBody", () => {
  const Body = z.object({ findingIds: z.array(z.string()).min(1) });

  it("returns typed data for a valid body", async () => {
    const req = new Request(url, { method: "POST", body: JSON.stringify({ findingIds: ["a"] }) });
    const r = await parseBody(req, (i) => Body.safeParse(i));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.findingIds).toEqual(["a"]);
  });

  it("returns 400 problems for invalid JSON and schema failures", async () => {
    const bad = await parseBody(new Request(url, { method: "POST", body: "{" }), (i) => Body.safeParse(i));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.response.status).toBe(400);

    const invalid = await parseBody(
      new Request(url, { method: "POST", body: JSON.stringify({ findingIds: [] }) }),
      (i) => Body.safeParse(i),
    );
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect((await invalid.response.json()).title).toBe("Validation failed");
  });
});
