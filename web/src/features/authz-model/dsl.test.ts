import { describe, expect, it } from "vitest";
import { diffDsl, newRelations, parseModel, summarize, tokenize, tokenizeLine } from "./dsl";
import { ACME_DRAFT_DSL_V7, ACME_LIVE_DSL_V6 } from "./fixtures";

describe("tokenizeLine", () => {
  it("classifies keywords, type names, relation names, operators and numbers", () => {
    expect(tokenizeLine("type folder", 1).tokens).toEqual([
      { kind: "keyword", text: "type" },
      { kind: "space", text: " " },
      { kind: "type", text: "folder" },
    ]);
    const define = tokenizeLine("    define viewer: [user] or editor or viewer from parent", 2);
    expect(define.indent).toBe("    ");
    const kinds = define.tokens.filter((t) => t.kind !== "space").map((t) => `${t.kind}:${t.text}`);
    expect(kinds).toEqual([
      "keyword:define",
      "relation:viewer",
      "punct::",
      "punct:[",
      "ident:user",
      "punct:]",
      "operator:or",
      "ident:editor",
      "operator:or",
      "ident:viewer",
      "operator:from",
      "ident:parent",
    ]);
    expect(tokenizeLine("  schema 1.1", 3).tokens).toContainEqual({ kind: "number", text: "1.1" });
  });

  it("treats 'but not' as one operator and '#' as a comment", () => {
    const t = tokenizeLine("define x: [user] but not blocked # note", 1).tokens;
    expect(t).toContainEqual({ kind: "operator", text: "but not" });
    expect(t.at(-1)).toEqual({ kind: "comment", text: "# note" });
  });

  it("never colours 'or' or 'from' before the colon", () => {
    const t = tokenizeLine("define from: [user]", 1).tokens;
    expect(t[2]).toEqual({ kind: "relation", text: "from" });
  });

  it("tokenizes every line with 1-based numbers", () => {
    const lines = tokenize("model\n  schema 1.1\n");
    expect(lines.map((l) => l.n)).toEqual([1, 2, 3]);
  });
});

describe("parseModel + summarize", () => {
  it("parses the v7 draft into 3 types, 8 relations, depth 3 with no issues", () => {
    const model = parseModel(ACME_DRAFT_DSL_V7);
    expect(model.issues).toEqual([]);
    expect(model.schema).toBe("1.1");
    expect(model.types.map((t) => t.name)).toEqual(["user", "folder", "document"]);
    expect(summarize(model)).toEqual({ types: 3, relations: 8, depth: 3 });
  });

  it("captures direct, computed and tuple-to-userset terms", () => {
    const model = parseModel(ACME_DRAFT_DSL_V7);
    const document = model.types.find((t) => t.name === "document")!;
    const viewer = document.relations.find((r) => r.name === "viewer")!;
    expect(viewer.direct).toEqual(["user"]);
    expect(viewer.computed).toEqual(["editor"]);
    expect(viewer.tupleToUserset).toEqual([{ relation: "viewer", via: "parent" }]);
  });

  it("reports unknown relation references", () => {
    const model = parseModel(`model
  schema 1.1
type user
type doc
  relations
    define viewer: [user] or editr
    define reader: [user] or viewer from owner
`);
    expect(model.issues.map((i) => i.message)).toEqual([
      'unknown relation "editr" referenced by doc.viewer',
      'unknown relation "owner" in "viewer from owner" on doc',
    ]);
    expect(model.issues[0]!.line).toBe(6);
  });

  it("reports relations missing on the parent type, unknown types, and structural errors", () => {
    const model = parseModel(`type folder
  relations
    define editor: [user]
type doc
  relations
    define parent: [folder]
    define auditor: [user] or auditor from parent
`);
    const messages = model.issues.map((i) => i.message);
    expect(messages).toContain('unknown type "user" in folder.editor');
    expect(messages).toContain('relation "auditor" is not defined on folder (via parent)');
    expect(messages).toContain("missing model header");
    expect(messages).toContain("missing schema version");
    expect(parseModel("define x: [user]").issues[0]!.message).toBe("define x outside a type");
  });
});

describe("diffDsl / newRelations", () => {
  it("marks the added auditor line and finds the new relation", () => {
    const { added, removed } = diffDsl(ACME_LIVE_DSL_V6, ACME_DRAFT_DSL_V7);
    const lines = ACME_DRAFT_DSL_V7.split("\n");
    expect([...added].map((n) => lines[n - 1]!.trim())).toEqual(["define auditor: [user]"]);
    expect(removed).toEqual([]);
    const fresh = newRelations(parseModel(ACME_LIVE_DSL_V6), parseModel(ACME_DRAFT_DSL_V7));
    expect([...fresh]).toEqual(["document#auditor"]);
  });

  it("reports removed lines when the draft drops a relation", () => {
    const { removed } = diffDsl(ACME_DRAFT_DSL_V7, ACME_LIVE_DSL_V6);
    expect(removed).toEqual(["define auditor: [user]"]);
  });
});
