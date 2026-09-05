import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { openSession, SESSION_COOKIE } from "@/server/session";
import { GET } from "./route";

const BASE = "http://localhost:3000/api/auth/login";

describe("GET /api/auth/login", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("in mock mode seals a session cookie and redirects to /dashboard", async () => {
    process.env.AUTH_MODE = "mock";
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE}=`);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=lax/i);
    const value = /azp_session=([^;]+)/.exec(setCookie)?.[1];
    const session = await openSession(value);
    expect(session?.role).toBe("platform superadmin");
  });

  it("honours a safe next path and rejects open redirects", async () => {
    process.env.AUTH_MODE = "mock";
    const ok = await GET(new NextRequest(`${BASE}?next=%2Ftenants%2Facme-air`));
    expect(ok.headers.get("location")).toBe("http://localhost:3000/tenants/acme-air");

    for (const bad of ["https://evil.example", "//evil.example", "/api/auth/logout", "tenants"]) {
      const res = await GET(new NextRequest(`${BASE}?next=${encodeURIComponent(bad)}`));
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    }
  });

  it("answers 501 problem+json in oidc mode until Zitadel exists", async () => {
    process.env.AUTH_MODE = "oidc";
    const res = await GET(new NextRequest(BASE));
    expect(res.status).toBe(501);
    expect(res.headers.get("content-type")).toBe("application/problem+json");
  });

  it("rejects an unknown AUTH_MODE", async () => {
    process.env.AUTH_MODE = "magic";
    expect((await GET(new NextRequest(BASE))).status).toBe(500);
  });
});
