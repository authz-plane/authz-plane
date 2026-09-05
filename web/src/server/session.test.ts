import { afterEach, describe, expect, it } from "vitest";
import {
  openSession,
  resetSessionKeyForTests,
  sealSession,
  type Session,
} from "./session";

const NOW = 1_800_000_000;

function session(overrides: Partial<Session> = {}): Session {
  return {
    sub: "user:test",
    name: "Test Operator",
    email: "test@authz-plane.test",
    role: "platform superadmin",
    iat: NOW,
    exp: NOW + 3600,
    ...overrides,
  };
}

describe("session cookie", () => {
  afterEach(() => {
    delete process.env.SESSION_SECRET;
    resetSessionKeyForTests();
  });

  it("round-trips a session", async () => {
    const cookie = await sealSession(session());
    expect(await openSession(cookie, NOW)).toEqual(session());
  });

  it("uses a fresh IV per seal so identical sessions never share ciphertext", async () => {
    const a = await sealSession(session());
    const b = await sealSession(session());
    expect(a).not.toEqual(b);
  });

  it("rejects an expired session", async () => {
    const cookie = await sealSession(session({ exp: NOW - 1 }));
    expect(await openSession(cookie, NOW)).toBeNull();
  });

  it("rejects a tampered cookie without throwing", async () => {
    const cookie = await sealSession(session());
    const [iv, body] = cookie.split(".") as [string, string];
    const flipped = body[0] === "A" ? "B" : "A";
    expect(await openSession(`${iv}.${flipped}${body.slice(1)}`, NOW)).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await openSession(undefined, NOW)).toBeNull();
    expect(await openSession("", NOW)).toBeNull();
    expect(await openSession("nodot", NOW)).toBeNull();
    expect(await openSession("not.base64!!", NOW)).toBeNull();
  });

  it("rejects a cookie sealed under a different key", async () => {
    const cookie = await sealSession(session());
    process.env.SESSION_SECRET = Buffer.alloc(32, 7).toString("base64url");
    resetSessionKeyForTests();
    expect(await openSession(cookie, NOW)).toBeNull();
  });

  it("refuses a SESSION_SECRET that is not 32 bytes", async () => {
    process.env.SESSION_SECRET = Buffer.alloc(16, 1).toString("base64url");
    resetSessionKeyForTests();
    await expect(sealSession(session())).rejects.toThrow(/32 bytes/);
  });
});
