import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { ACME_DRAFT_DSL_V7, ACME_LIVE_DSL_V6 } from "../fixtures";
import { DslView } from "./dsl-view";

describe("DslView", () => {
  it("renders token classes per kind", () => {
    render(<DslView live={ACME_LIVE_DSL_V6} draft={ACME_DRAFT_DSL_V7} />);
    const view = screen.getByTestId("dsl-view");
    const byKind = (kind: string) => Array.from(view.querySelectorAll<HTMLElement>(`[data-kind="${kind}"]`));

    expect(byKind("keyword").every((el) => el.className.includes("text-fg-tertiary"))).toBe(true);
    expect(byKind("type").map((el) => el.textContent)).toEqual(["user", "folder", "document"]);
    expect(byKind("type").every((el) => el.className.includes("text-drift"))).toBe(true);
    expect(byKind("relation").every((el) => el.className.includes("text-link"))).toBe(true);
    expect(byKind("operator").map((el) => el.textContent)).toContain("from");
    expect(byKind("operator").every((el) => el.className.includes("text-degraded"))).toBe(true);
    expect(byKind("number")[0]).toHaveTextContent("1.1");
    expect(byKind("number")[0]!.className).toContain("text-accent");
  });

  it("marks the added auditor line as a ready-tinted full-bleed line with a + glyph", () => {
    render(<DslView live={ACME_LIVE_DSL_V6} draft={ACME_DRAFT_DSL_V7} />);
    const added = screen.getByTestId("dsl-view").querySelectorAll("[data-added]");
    expect(added).toHaveLength(1);
    expect(added[0]!.className).toContain("bg-ready-tint");
    expect(added[0]).toHaveTextContent("+ define auditor: [user]");
    expect(screen.getByLabelText("added")).toHaveTextContent("+");
  });

  it("renders every line with white-space: pre so indentation survives", () => {
    render(<DslView live={ACME_LIVE_DSL_V6} draft={ACME_DRAFT_DSL_V7} />);
    const lines = screen.getByTestId("dsl-view").querySelectorAll("[data-line]");
    expect(lines.length).toBe(ACME_DRAFT_DSL_V7.split("\n").length);
    expect(Array.from(lines).every((l) => l.className.includes("whitespace-pre"))).toBe(true);
  });
});
