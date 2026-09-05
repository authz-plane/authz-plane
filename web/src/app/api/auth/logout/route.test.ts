import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { POST } from "./route";

const URL = "http://localhost:3000/api/auth/logout";

describe("POST /api/auth/logout", () => {
  it("clears the cookie and redirects to /login for a same-origin request", async () => {
    const res = await POST(new NextRequest(URL, { method: "POST", headers: { origin: "http://localhost:3000" } }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
    expect(res.headers.get("set-cookie")).toMatch(/azp_session=;.*Max-Age=0/);
  });

  it("refuses a cross-origin sign-out", async () => {
    const res = await POST(new NextRequest(URL, { method: "POST", headers: { origin: "https://evil.example" } }));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});
