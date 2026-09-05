import { beforeEach, describe, expect, it } from "vitest";
import { acmeTuples } from "./fixtures";
import { toNdjson, utcDayTime } from "./format";
import { parseRelationsFilter, TupleSchema, WriteRequestSchema } from "./schemas";
import { listRelations, resetRelationsStore, writeRelations } from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");

beforeEach(() => resetRelationsStore());

describe("fixtures and helpers", () => {
  it("every tuple satisfies the wire schema and ids are unique", () => {
    const tuples = acmeTuples();
    for (const t of tuples) expect(() => TupleSchema.parse(t)).not.toThrow();
    expect(new Set(tuples.map((t) => t.id)).size).toBe(tuples.length);
    expect(tuples.filter((t) => t.source.kind === "drift")).toHaveLength(1);
  });

  it("formats UTC and NDJSON deterministically", () => {
    expect(utcDayTime("2026-08-30T09:12:00Z")).toBe("Aug 30 09:12Z");
    const nd = toNdjson(acmeTuples().slice(0, 2));
    expect(nd.split("\n")).toHaveLength(3);
    expect(JSON.parse(nd.split("\n")[0]!)).toMatchObject({ id: "t-0001" });
  });

  it("normalises search params into a filter with no empty keys", () => {
    expect(parseRelationsFilter({ user: " user:raj ", relation: "", object: undefined })).toEqual({ user: "user:raj" });
    expect(parseRelationsFilter({ user: ["a", "b"] })).toEqual({});
  });

  it("rejects an empty batch and malformed refs at the schema", () => {
    expect(WriteRequestSchema.safeParse({ writes: [], deletes: [] }).success).toBe(false);
    expect(WriteRequestSchema.safeParse({ writes: [{ user: "raj", relation: "viewer", object: "folder:x" }], deletes: [] }).success).toBe(false);
    expect(WriteRequestSchema.safeParse({ writes: [{ user: "user:raj", relation: "viewer", object: "folder:x" }], deletes: [] }).success).toBe(true);
  });
});

describe("listRelations", () => {
  it("pages six at a time with an opaque cursor, then ends", async () => {
    const p1 = (await listRelations("acme-air", {}, undefined))!;
    expect(p1.items.map((t) => t.id)).toEqual(["t-0001", "t-0002", "t-0003", "t-0004", "t-0005", "t-0006"]);
    expect(p1.nextCursor).toBe("c6");
    expect(p1.total).toBe(1284);
    expect(p1.modelVersion).toBe(6);
    expect(p1.cachedDecisions).toBe(41);

    const p2 = (await listRelations("acme-air", {}, p1.nextCursor!))!;
    expect(p2.items).toHaveLength(6);
    expect(p2.items[0]!.id).toBe("t-0007");
    expect(p2.nextCursor).toBeNull();
  });

  it("filters exactly or by prefix and reports the filtered total", async () => {
    const byUser = (await listRelations("acme-air", { user: "user:raj" }, undefined))!;
    expect(byUser.items.map((t) => t.id)).toEqual(["t-0001", "t-0002", "t-0007"]);
    expect(byUser.total).toBe(3);
    const byPrefix = (await listRelations("acme-air", { object: "folder:*", relation: "editor" }, undefined))!;
    expect(byPrefix.items.map((t) => t.object)).toEqual(["folder:finance", "folder:finance", "folder:ops"]);
    expect(byPrefix.nextCursor).toBeNull();
  });

  it("returns null for unknown tenants and generic rows for others", async () => {
    expect(await listRelations("nope", {}, undefined)).toBeNull();
    const g = (await listRelations("globex-logistics", {}, undefined))!;
    expect(g.total).toBe(240);
    expect(g.items.length).toBeGreaterThan(0);
  });
});

describe("writeRelations", () => {
  it("rejects the reserved platform:* namespace with a 400 problem and applies nothing", async () => {
    const r = await writeRelations(
      "acme-air",
      {
        writes: [{ user: "user:mira", relation: "viewer", object: "folder:ops" }],
        deletes: [{ user: "user:raj", relation: "viewer", object: "platform:root" }],
      },
      NOW,
    );
    expect(r).toMatchObject({ ok: false, status: 400, title: "Reserved namespace" });
    if (!r.ok) expect(r.detail).toContain("platform:* is reserved");
    const after = (await listRelations("acme-air", { user: "user:mira" }, undefined))!;
    expect(after.items.some((t) => t.object === "folder:ops" && t.relation === "viewer")).toBe(false);
  });

  it("rejects relations the live model does not define", async () => {
    const unknownRelation = await writeRelations(
      "acme-air",
      { writes: [{ user: "user:mira", relation: "auditor", object: "document:budget-2026" }], deletes: [] },
      NOW,
    );
    expect(unknownRelation).toMatchObject({ ok: false, status: 400, title: "Relation not in model" });
    if (!unknownRelation.ok) expect(unknownRelation.detail).toBe("auditor is not defined on document in model v6 · user:mira auditor document:budget-2026 rejected");

    const unknownType = await writeRelations(
      "acme-air",
      { writes: [{ user: "user:mira", relation: "admin", object: "tenant:acme-air" }], deletes: [] },
      NOW,
    );
    expect(unknownType).toMatchObject({ ok: false, status: 400, title: "Relation not in model" });
  });

  it("applies writes and deletes atomically, adjusts the total, and is idempotent for repeats", async () => {
    const batch = {
      writes: [{ user: "user:mira", relation: "viewer", object: "folder:ops" }],
      deletes: [
        { user: "user:dana", relation: "editor", object: "folder:finance" },
        { user: "user:ext-audit", relation: "admin", object: "tenant:acme-air" },
      ],
    };
    const r = await writeRelations("acme-air", batch, NOW);
    expect(r).toEqual({ ok: true, data: { written: 1, deleted: 2, invalidatedDecisions: 41, modelVersion: 6 } });

    const all = (await listRelations("acme-air", {}, undefined, 100))!;
    expect(all.total).toBe(1283);
    expect(all.items.some((t) => t.id === "t-0006")).toBe(false);
    expect(all.items.some((t) => t.source.kind === "drift")).toBe(false);
    const added = all.items.find((t) => t.user === "user:mira" && t.object === "folder:ops" && t.relation === "viewer")!;
    expect(added).toMatchObject({ source: { kind: "api" }, writtenAt: NOW.toISOString() });

    const again = await writeRelations("acme-air", batch, NOW);
    expect(again).toEqual({ ok: true, data: { written: 0, deleted: 0, invalidatedDecisions: 41, modelVersion: 6 } });
  });
});
