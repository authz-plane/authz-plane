import { describe, expect, it } from "vitest";
import { alignLines, changedFieldsLabel, diffLines, pairChanges, sideBySide, summarize, unifiedLines, yamlKey } from "./diff";
import { acmeVersions } from "./fixtures";

const byGen = (g: number) => acmeVersions().find((v) => v.generation === g)!.body;

describe("alignLines", () => {
  it("returns equal ops for identical text and nothing else", () => {
    const ops = alignLines("a\nb\nc", "a\nb\nc");
    expect(ops.every((o) => o.kind === "equal")).toBe(true);
    expect(ops).toHaveLength(3);
  });

  it("finds an insertion and a deletion with 1-based line numbers on the right side", () => {
    const ops = alignLines("a\nb\nc", "a\nx\nb");
    expect(ops.map((o) => o.kind)).toEqual(["equal", "added", "equal", "removed"]);
    expect(ops[1]).toMatchObject({ right: "x", rightN: 2 });
    expect(ops[3]).toMatchObject({ left: "c", leftN: 3 });
  });

  it("ignores a single trailing newline", () => {
    expect(alignLines("a\nb\n", "a\nb")).toHaveLength(2);
  });
});

describe("pairChanges / yamlKey", () => {
  it("keys on indent, list dash and key name", () => {
    expect(yamlKey("      clientSecretRef: x")).toBe("6:clientSecretRef");
    expect(yamlKey("    - key: tenant_admin")).toBe("4:-key");
    expect(yamlKey("    model")).toBeNull();
  });

  it("collapses a removed/added pair with the same key into one changed op", () => {
    const ops = pairChanges(alignLines("  ref: old\n  other: 1", "  ref: new\n  other: 1"));
    expect(ops[0]).toMatchObject({ kind: "changed", left: "  ref: old", right: "  ref: new" });
    expect(ops[1]!.kind).toBe("equal");
  });

  it("leaves unrelated removed/added lines as they are", () => {
    const ops = pairChanges(alignLines("a: 1", "b: 2"));
    expect(ops.map((o) => o.kind)).toEqual(["removed", "added"]);
  });

  it("never pairs list items, so a replaced tuple reads as delete + insert", () => {
    const ops = pairChanges(alignLines(["- user: user:dana", "  relation: editor"].join("\n"), ["- user: user:mira", "  relation: auditor"].join("\n")));
    expect(ops.map((o) => o.kind)).toEqual(["removed", "removed", "added", "added"]);
  });
});

describe("gen 8 → gen 9 (frame 06)", () => {
  const ops = diffLines(byGen(8), byGen(9));

  it("has four changed fields: secret ref, model v7, auditor role, and dana's tuple replaced by mira's", () => {
    const s = summarize(ops);
    expect(s.hunks).toBe(4);
    expect(changedFieldsLabel(s)).toBe("4 changed fields");
    expect(s.changed).toBe(1);
    const changed = ops.find((o) => o.kind === "changed")!;
    expect(changed.left).toBe("      clientSecretRef: acme-entra-old");
    expect(changed.right).toBe("      clientSecretRef: acme-entra-secret");
    expect(ops.filter((o) => o.kind === "added").map((o) => o.right)).toEqual(
      expect.arrayContaining(["    - key: tenant_auditor", "      permissions: [tenant.read, audit.read]", "    - user: user:mira"]),
    );
    expect(ops.filter((o) => o.kind === "removed").map((o) => o.left)).toContain("    - user: user:dana");
  });

  it("renders both side-by-side panes with changed rows on each and no placeholder rows", () => {
    const { left, right } = sideBySide(ops);
    expect(left.filter((l) => l.kind === "changed")).toHaveLength(1);
    expect(right.filter((l) => l.kind === "changed")).toHaveLength(1);
    expect(left.some((l) => l.kind === "added")).toBe(false);
    expect(right.some((l) => l.kind === "removed")).toBe(false);
    expect(left.filter((l) => l.kind === "removed").map((l) => l.text)).toContain("    - user: user:dana");
    expect(left).toHaveLength(byGen(8).split("\n").length);
  });

  it("collapses context in the unified change preview", () => {
    const lines = unifiedLines(ops, 0);
    const collapsed = lines.filter((l) => l.kind === "context");
    expect(collapsed.length).toBeGreaterThan(0);
    expect(collapsed.every((l) => /^\d+ unchanged lines?$/.test(l.text))).toBe(true);
    expect(lines.filter((l) => l.kind !== "context").length).toBe(summarize(ops).added + summarize(ops).removed + summarize(ops).changed);
  });

  it("keeps every line when context is Infinity", () => {
    const lines = unifiedLines(ops, Infinity);
    expect(lines.filter((l) => l.kind === "context")).toHaveLength(summarize(ops).unchanged);
  });
});

describe("changedFieldsLabel", () => {
  it("handles zero and one", () => {
    expect(changedFieldsLabel(summarize(diffLines("a", "a")))).toBe("no changes");
    expect(changedFieldsLabel(summarize(diffLines("a: 1", "a: 2")))).toBe("1 changed field");
  });
});
