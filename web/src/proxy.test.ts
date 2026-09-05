import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";
import { sealSession, SESSION_COOKIE } from "./server/session";

const ORIGIN = "http://localhost:3000";

async function signedIn(path: string) {
  const now = Math.floor(Date.now() / 1000);
  const cookie = await sealSession({
    sub: "user:t",
    name: "T",
    email: "t@authz-plane.test",
    role: "r",
    iat: now,
    exp: now + 60,
  });
  return new NextRequest(`${ORIGIN}${path}`, { headers: { cookie: `${SESSION_COOKIE}=${cookie}` } });
}

describe("proxy", () => {
  it("sends anonymous visitors to /login and remembers where they were going", async () => {
    const res = await proxy(new NextRequest(`${ORIGIN}/tenants/acme-air`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login?next=%2Ftenants%2Facme-air`);
  });

  it("does not add next for the root path", async () => {
    const res = await proxy(new NextRequest(`${ORIGIN}/`));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/login`);
  });

  it("lets anonymous visitors see /login", async () => {
    const res = await proxy(new NextRequest(`${ORIGIN}/login`));
    expect(res.headers.get("location")).toBeNull();
  });

  it("bounces signed-in visitors away from /login", async () => {
    const res = await proxy(await signedIn("/login"));
    expect(res.headers.get("location")).toBe(`${ORIGIN}/dashboard`);
  });

  it("passes signed-in visitors through to console pages", async () => {
    const res = await proxy(await signedIn("/dashboard"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("treats a tampered cookie as anonymous", async () => {
    const req = new NextRequest(`${ORIGIN}/dashboard`, { headers: { cookie: `${SESSION_COOKIE}=abc.def` } });
    const res = await proxy(req);
    expect(res.headers.get("location")).toContain("/login");
  });
});
