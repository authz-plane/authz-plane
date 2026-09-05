import { beforeEach, describe, expect, it } from "vitest";
import { ACME_DRAFT_DSL_V7, ACME_LIVE_DSL_V6 } from "./fixtures";
import { AuthorizationModelSchema } from "./schemas";
import { getAuthorizationModel, resetAuthzModelStore, stageModel, validateModel } from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");

beforeEach(() => resetAuthzModelStore());

describe("getAuthorizationModel", () => {
  it("returns the acme-air v6/v7 pair that satisfies the schema", async () => {
    const model = await getAuthorizationModel("acme-air");
    expect(model).not.toBeNull();
    expect(() => AuthorizationModelSchema.parse(model)).not.toThrow();
    expect(model!.liveVersion).toBe(6);
    expect(model!.draftVersion).toBe(7);
    expect(model!.live).toBe(ACME_LIVE_DSL_V6);
    expect(model!.draft).toBe(ACME_DRAFT_DSL_V7);
    expect(model!.tupleCount).toBe(1284);
    expect(model!.versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(model!.versions.find((v) => v.state === "live")?.version).toBe(6);
  });

  it("falls back to a generic model at the tenant's live version for other tenants", async () => {
    const model = await getAuthorizationModel("northwind-rail");
    expect(model!.liveVersion).toBe(2);
    expect(model!.draftVersion).toBeNull();
    expect(model!.versions).toHaveLength(2);
  });

  it("returns null for an unknown slug", async () => {
    expect(await getAuthorizationModel("nope")).toBeNull();
  });
});

describe("validateModel", () => {
  it("counts types, relations and depth for a valid DSL", async () => {
    const r = await validateModel("acme-air", ACME_DRAFT_DSL_V7);
    expect(r.ok && r.data).toMatchObject({ ok: true, types: 3, relations: 8, depth: 3, tuplesValidated: 1284, issues: [] });
  });

  it("reports unknown relation references and validates no tuples", async () => {
    const r = await validateModel("acme-air", "model\n  schema 1.1\ntype user\ntype doc\n  relations\n    define viewer: [user] or editr\n");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.ok).toBe(false);
    expect(r.data.issues[0]!.message).toContain('unknown relation "editr"');
    expect(r.data.tuplesValidated).toBe(0);
  });

  it("404s for an unknown tenant", async () => {
    const r = await validateModel("nope", ACME_DRAFT_DSL_V7);
    expect(r).toMatchObject({ ok: false, status: 404 });
  });
});

describe("stageModel", () => {
  it("stages a parsing draft into generation 10 and records it in the store", async () => {
    const r = await stageModel("acme-air", ACME_DRAFT_DSL_V7, NOW);
    expect(r).toEqual({ ok: true, data: { generation: 10, version: 7, stagedAt: NOW.toISOString() } });
    const model = await getAuthorizationModel("acme-air");
    expect(model!.versions.find((v) => v.version === 7)?.summary).toBe("staged into generation 10");
  });

  it("rejects a draft that does not parse with a 400 problem", async () => {
    const r = await stageModel("acme-air", "model\n  schema 1.1\ntype doc\n  relations\n    define v: [user] or nope\n", NOW);
    expect(r).toMatchObject({ ok: false, status: 400, title: "Model does not parse" });
    if (!r.ok) expect(r.detail).toMatch(/^line 5:/);
  });
});
