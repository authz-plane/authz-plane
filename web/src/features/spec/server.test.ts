import { beforeEach, describe, expect, it } from "vitest";
import { resetReconcileStoreForTests } from "@/features/reconcile/server";
import { acmeVersions } from "./fixtures";
import { SpecDocumentSchema } from "./schemas";
import {
  enqueueReconcile,
  getSpec,
  listVersions,
  planSpec,
  resetSpecStoreForTests,
  restoreVersion,
  saveSpec,
  validateSpec,
} from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");
const AUTHOR = "raj@example.test";

beforeEach(() => {
  resetSpecStoreForTests();
  resetReconcileStoreForTests();
});

describe("getSpec / listVersions", () => {
  it("returns acme-air's generation 9 with a 62-line body", async () => {
    const spec = await getSpec("acme-air");
    expect(() => SpecDocumentSchema.parse(spec)).not.toThrow();
    expect(spec).toMatchObject({ slug: "acme-air", generation: 9, lineCount: 62 });
    expect(spec!.hash).toBe(acmeVersions()[0]!.hash);
  });

  it("lists nine versions with current / applied / superseded statuses", async () => {
    const v = await listVersions("acme-air");
    expect(v!.total).toBe(9);
    expect(v!.currentGeneration).toBe(9);
    expect(v!.observedGeneration).toBe(8);
    expect(v!.items[0]!.status).toBe("current");
    expect(v!.items[1]!.status).toBe("applied");
  });

  it("derives a generic spec for other canonical tenants and null for unknown slugs", async () => {
    const nw = await getSpec("northwind-rail");
    expect(nw!.generation).toBe(4);
    expect(nw!.body).toContain("slug: northwind-rail");
    const versions = await listVersions("northwind-rail");
    expect(versions!.items.map((x) => x.generation)).toEqual([4, 3, 2, 1]);
    expect(await getSpec("nope")).toBeNull();
    expect(await listVersions("nope")).toBeNull();
  });
});

describe("validateSpec", () => {
  it("compares against the applied generation and reports a duration", async () => {
    const spec = await getSpec("acme-air");
    const r = await validateSpec("acme-air", spec!.body);
    expect(r!.valid).toBe(true);
    expect(r!.warnings).toBe(1);
    expect(r!.durationMs).toBeGreaterThanOrEqual(41);
  });
});

describe("saveSpec", () => {
  it("returns 428 without If-Match and 412 when the generation moved", async () => {
    const spec = await getSpec("acme-air");
    const noMatch = await saveSpec("acme-air", spec!.body, null, "k1", AUTHOR, NOW);
    expect(noMatch).toMatchObject({ ok: false, status: 428 });

    const stale = await saveSpec("acme-air", spec!.body, 8, "k2", AUTHOR, NOW);
    expect(stale).toMatchObject({ ok: false, status: 412, title: "Spec changed underneath you" });
    expect(!stale.ok && stale.detail).toContain("reload and re-diff");
  });

  it("rejects bodies that fail validation with a 400 problem", async () => {
    const spec = await getSpec("acme-air");
    const r = await saveSpec("acme-air", spec!.body.replace("  slug: acme-air", "   slug: acme-air"), 9, "k3", AUTHOR, NOW);
    expect(r).toMatchObject({ ok: false, status: 400, title: "Spec does not validate" });
    expect((await getSpec("acme-air"))!.generation).toBe(9);
  });

  it("appends generation 10, moves If-Match on, and enqueues a run", async () => {
    const spec = await getSpec("acme-air");
    const body = spec!.body.replace("resyncIntervalSeconds: 600", "resyncIntervalSeconds: 300");
    const r = await saveSpec("acme-air", body, 9, "k4", AUTHOR, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.generation).toBe(10);
    expect(r.data.runId).toMatch(/^[0-9a-f]{12}$/);

    const after = await getSpec("acme-air");
    expect(after!.generation).toBe(10);
    expect(after!.body).toBe(body);

    const versions = await listVersions("acme-air");
    expect(versions!.total).toBe(10);
    expect(versions!.items[0]).toMatchObject({ generation: 10, author: AUTHOR, status: "current", summary: "1 changed" });
    expect(versions!.items[1]).toMatchObject({ generation: 9, status: "superseded" });
    expect(versions!.items[2]).toMatchObject({ generation: 8, status: "applied" });

    // The old generation now 412s.
    const stale = await saveSpec("acme-air", body, 9, "k5", AUTHOR, NOW);
    expect(stale).toMatchObject({ ok: false, status: 412 });
  });

  it("replays the same Idempotency-Key without creating another generation", async () => {
    const spec = await getSpec("acme-air");
    const a = await saveSpec("acme-air", spec!.body, 9, "same", AUTHOR, NOW);
    const b = await saveSpec("acme-air", spec!.body, 9, "same", AUTHOR, NOW);
    expect(a).toEqual(b);
    expect((await listVersions("acme-air"))!.total).toBe(10);
  });
});

describe("restoreVersion", () => {
  it("writes gen 8's body as a new generation and leaves history intact", async () => {
    const before = await listVersions("acme-air");
    const gen8 = before!.items.find((v) => v.generation === 8)!;
    const r = await restoreVersion("acme-air", 8, "r1", AUTHOR, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.generation).toBe(10);

    const after = await listVersions("acme-air");
    expect(after!.total).toBe(10);
    expect(after!.items[0]).toMatchObject({ generation: 10, body: gen8.body, hash: gen8.hash, summary: "restore of gen 8" });
    // History is immutable: gen 8 and gen 9 are still there, byte for byte.
    expect(after!.items.find((v) => v.generation === 8)!.body).toBe(gen8.body);
    expect(after!.items.find((v) => v.generation === 9)!.body).toBe(before!.items[0]!.body);
  });

  it("refuses to restore the current generation or a missing one", async () => {
    expect(await restoreVersion("acme-air", 9, "r2", AUTHOR, NOW)).toMatchObject({ ok: false, status: 409 });
    expect(await restoreVersion("acme-air", 42, "r3", AUTHOR, NOW)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("planSpec / enqueueReconcile", () => {
  it("plans the current generation without a draft and the next one with a draft", async () => {
    const current = await planSpec("acme-air", undefined, NOW);
    expect(current!.generation).toBe(9);
    const draft = await planSpec("acme-air", "apiVersion: authzplane.dev/v1", NOW);
    expect(draft!.generation).toBe(10);
    expect(draft!.summary).toEqual({ create: 4, update: 2, delete: 1, unchanged: 18 });
    expect(draft!.actualReadAt).toBe("2026-09-04T10:14:22.000Z");
    expect(await planSpec("nope", undefined, NOW)).toBeNull();
  });

  it("re-enqueues through the reconcile feature and is idempotent per key", async () => {
    const a = await enqueueReconcile("acme-air", "key-a", NOW);
    const b = await enqueueReconcile("acme-air", "key-a", NOW);
    expect(a.runId).toMatch(/^[0-9a-f]{12}$/);
    expect(a).toEqual(b);
    const c = await enqueueReconcile("acme-air", "key-c", NOW);
    expect(c.runId).not.toBe(a.runId);
  });
});
