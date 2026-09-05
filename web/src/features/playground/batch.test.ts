import { describe, expect, it } from "vitest";
import { parseBatch } from "./batch";
import { BATCH_PLACEHOLDER } from "./fixtures";

describe("parseBatch", () => {
  it("parses one whitespace-separated tuple per line and skips blanks", () => {
    const r = parseBatch(`${BATCH_PLACEHOLDER}\n\n  user:lee   viewer\tfolder:finance  \n`);
    expect(r).toEqual({
      ok: true,
      checks: [
        { user: "user:raj", relation: "viewer", object: "document:budget-2026" },
        { user: "user:ana", relation: "editor", object: "document:budget-2026" },
        { user: "user:lee", relation: "owner", object: "folder:finance" },
        { user: "user:lee", relation: "viewer", object: "folder:finance" },
      ],
    });
  });

  it("reports the 1-based line of the first malformed row", () => {
    expect(parseBatch("user:raj viewer document:a\nuser:ana editor")).toEqual({
      ok: false,
      line: 2,
      message: 'expected "user relation object", got 2 fields',
    });
    const bad = parseBatch("raj viewer document:a");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad).toMatchObject({ line: 1, message: "expected type:id" });
  });

  it("rejects an empty batch", () => {
    expect(parseBatch("\n  \n")).toEqual({ ok: false, line: 0, message: "add at least one tuple" });
  });
});
