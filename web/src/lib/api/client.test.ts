import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { BffError, bffGet, bffMutate, idempotencyKey } from "./client";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

const Shape = z.object({ ok: z.boolean() });

describe("bffGet", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("parses a successful body against the schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true })));
    await expect(bffGet("/api/x", Shape)).resolves.toEqual({ ok: true });
  });

  it("surfaces problem+json title and detail as a BffError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse({ title: "Not signed in", detail: "cookie missing", status: 401 }, { status: 401 }),
      ),
    );
    const err = await bffGet("/api/x", Shape).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BffError);
    expect((err as BffError).status).toBe(401);
    expect((err as BffError).title).toBe("Not signed in");
    expect((err as BffError).message).toBe("cookie missing");
  });

  it("falls back to the status text when the error body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("boom", { status: 502, statusText: "Bad Gateway" })));
    const err = (await bffGet("/api/x", Shape).catch((e: unknown) => e)) as BffError;
    expect(err.title).toBe("Bad Gateway");
  });

  it("rejects a body that violates the schema", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: "yes" })));
    await expect(bffGet("/api/x", Shape)).rejects.toThrow();
  });
});

describe("bffMutate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends JSON with an Idempotency-Key and same-origin credentials", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    await bffMutate("/api/x", { body: { a: 1 } }, Shape);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/x");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("same-origin");
    const headers = init.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["content-type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("returns null when no schema is given or the response is 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(bffMutate("/api/x", { method: "DELETE" }, null)).resolves.toBeNull();
  });

  it("passes extra headers such as If-Match through", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await bffMutate("/api/x", { method: "PUT", headers: { "if-match": "9" } }, null);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)["if-match"]).toBe("9");
  });
});

describe("idempotencyKey", () => {
  it("is unique per call", () => {
    expect(idempotencyKey()).not.toBe(idempotencyKey());
  });
});
