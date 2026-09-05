import { describe, expect, it } from "vitest";
import { ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY } from "./fixtures";
import { batchCheck, DEPTH_CAP, explain, relationsOf, type AuthorizationModel } from "./resolver";
import { ExplainResponseSchema } from "./schemas";

const OPTS = { now: "2026-09-04T10:15:00Z", modelVersion: 6, consistency: "strong" as const };

describe("explain", () => {
  it("allows user:raj viewer document:budget-2026 through the parent folder's editor tuple (system design §9.1)", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, OPTS);
    expect(ExplainResponseSchema.parse(r)).toEqual(r);
    expect(r.allowed).toBe(true);
    expect(r.tree.node).toBe("document:budget-2026#viewer");
    expect(r.tree.via).toBe("union");
    const vias = r.tree.children?.map((c) => [c.node, c.result, c.via]);
    expect(vias).toEqual([
      ["document:budget-2026#viewer@user:raj", "denied", "direct"],
      ["document:budget-2026#editor", "denied", "computed"],
      ["document:budget-2026#parent", "allowed", "tupleToUserset"],
    ]);
    const leaf = r.tree.children?.[2]?.children?.[0];
    expect(leaf).toMatchObject({ node: "folder:finance#editor@user:raj", result: "allowed", via: "direct" });
    expect(r.stats).toEqual({ nodesEvaluated: 5, maxDepth: 3, depthCap: 8, depthCapHit: false, fgaCalls: 1 });
    expect(r.durationMs).toBe(7);
    expect(r.cached).toBe(false);
  });

  it("names the decisive tuple with its author and audit event", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, OPTS);
    expect(r.decisive).toEqual({
      node: "folder:finance#editor@user:raj",
      tupleId: "a3f1d2e4b6c9",
      writtenAt: "2026-08-30T09:00:00Z",
      writtenBy: "admin@acme.test",
      auditEventId: "evt_tuple_a3f1",
    });
    const leaf = r.tree.children?.[2]?.children?.[0];
    expect(leaf?.tupleId).toBe("a3f1d2e4b6c9");
    expect(leaf?.writtenBy).toBe("admin@acme.test");
    expect(r.reason).toContain("raj can view budget-2026");
    expect(r.reason).toContain("editor of folder:finance");
  });

  it("omits provenance from the tree when not requested but still attributes the decision", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, { ...OPTS, includeProvenance: false });
    const leaf = r.tree.children?.[2]?.children?.[0];
    expect(leaf?.tupleId).toBeUndefined();
    expect(r.decisive?.tupleId).toBe("a3f1d2e4b6c9");
  });

  it("denies an unknown user with no decisive tuple and a plain-language reason", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, { ...DEFAULT_QUERY, user: "user:nobody" }, OPTS);
    expect(r.allowed).toBe(false);
    expect(r.decisive).toBeNull();
    expect(r.tree.result).toBe("denied");
    expect(r.tree.children?.every((c) => c.result === "denied")).toBe(true);
    expect(r.reason).toMatch(/^nobody cannot view budget-2026/);
  });

  it("denies an unknown relation without evaluating branches", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, { ...DEFAULT_QUERY, relation: "publisher" }, OPTS);
    expect(r.allowed).toBe(false);
    expect(r.tree).toEqual({ node: "document:budget-2026#publisher", result: "denied", via: "direct" });
    expect(r.stats.nodesEvaluated).toBe(1);
  });

  it("stops at the depth cap on a cyclic model and says so", () => {
    const cyclic: AuthorizationModel = {
      user: {},
      folder: {
        viewer: { computed: ["editor"] },
        editor: { computed: ["viewer"] },
      },
    };
    const r = explain(cyclic, [], { user: "user:raj", relation: "viewer", object: "folder:loop" }, OPTS);
    expect(r.allowed).toBe(false);
    expect(r.stats.depthCapHit).toBe(true);
    expect(r.stats.maxDepth).toBe(DEPTH_CAP);
    let node = r.tree;
    while (node.children?.[0]) node = node.children[0];
    expect(node.truncated).toBe(true);
    expect(r.reason).toContain(`depth cap of ${DEPTH_CAP}`);
  });

  it("eventual consistency reports a cache hit", () => {
    const r = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, { ...OPTS, consistency: "eventual" });
    expect(r.cached).toBe(true);
    expect(r.durationMs).toBe(2);
  });
});

describe("batchCheck", () => {
  it("returns one allowed/denied row per check without trees", () => {
    const r = batchCheck(
      ACME_AIR_MODEL_V6,
      ACME_AIR_TUPLES,
      [DEFAULT_QUERY, { user: "user:ana", relation: "editor", object: "document:budget-2026" }, { user: "user:lee", relation: "owner", object: "folder:finance" }],
      OPTS,
    );
    expect(r.results.map((x) => x.allowed)).toEqual([true, false, true]);
    expect(r.results[0]).toEqual({ ...DEFAULT_QUERY, allowed: true, durationMs: 7 });
    expect(r.modelVersion).toBe(6);
  });
});

describe("relationsOf", () => {
  it("lists every relation the model defines once, in first-seen order", () => {
    expect(relationsOf(ACME_AIR_MODEL_V6)).toEqual(["owner", "editor", "viewer", "auditor", "parent"]);
  });
});
