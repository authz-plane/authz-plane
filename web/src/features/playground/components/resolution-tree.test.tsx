import { describe, expect, it } from "vitest";
import { act, render, screen, userEvent, within } from "@/test/render";
import { ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY } from "../fixtures";
import { explain } from "../resolver";
import { pillFor, ResolutionTree } from "./resolution-tree";

const RESULT = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, { now: "2026-09-04T10:15:00Z", modelVersion: 6, consistency: "strong" });

describe("ResolutionTree", () => {
  it("is a role=tree of treeitems carrying aria-expanded, aria-selected and the result word", () => {
    render(<ResolutionTree root={RESULT.tree} />);
    const tree = screen.getByRole("tree", { name: "Resolution tree" });
    const items = within(tree).getAllByRole("treeitem");
    expect(items).toHaveLength(5);
    for (const item of items) expect(item).toHaveAttribute("aria-selected");

    const root = items[0]!;
    expect(root).toHaveAttribute("aria-expanded", "true");
    expect(root).toHaveAttribute("aria-selected", "true");
    expect(root).toHaveAttribute("aria-level", "1");
    expect(root).toHaveAccessibleName("document:budget-2026#viewer allowed");

    const direct = screen.getByRole("treeitem", { name: "document:budget-2026#viewer@user:raj denied" });
    expect(direct).not.toHaveAttribute("aria-expanded");
    expect(direct).toHaveAttribute("aria-selected", "false");
    // Failed branches take the one-off frame colours.
    expect(direct.firstElementChild?.className).toContain("bg-[#0F0E11]");
    expect(direct.firstElementChild?.className).toContain("border-[#26202A]");
  });

  it("labels each node with its via pill and marks the decisive tuple", () => {
    render(<ResolutionTree root={RESULT.tree} />);
    expect(screen.getByText("union")).toBeInTheDocument();
    expect(screen.getByText("direct")).toBeInTheDocument();
    expect(screen.getByText("computed")).toBeInTheDocument();
    expect(screen.getByText("tupleToUserset").className).toContain("text-drift");
    expect(screen.getByText("decisive tuple").className).toContain("text-ready");
    const leaf = RESULT.tree.children![2]!.children![0]!;
    expect(pillFor(leaf)).toBe("decisive");
    expect(pillFor({ ...leaf, tupleId: undefined })).toBe("direct");
  });

  it("collapses and expands with Enter, Space and the arrow keys, and selects the focused node", async () => {
    render(<ResolutionTree root={RESULT.tree} />);
    const parent = screen.getByRole("treeitem", { name: "document:budget-2026#parent allowed" });
    expect(parent).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: "folder:finance#editor@user:raj allowed" })).toBeInTheDocument();

    act(() => parent.focus());
    expect(parent).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("treeitem", { name: "document:budget-2026#viewer allowed" })).toHaveAttribute("aria-selected", "false");

    await userEvent.keyboard("{Enter}");
    expect(parent).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: "folder:finance#editor@user:raj allowed" })).not.toBeInTheDocument();

    await userEvent.keyboard(" ");
    expect(parent).toHaveAttribute("aria-expanded", "true");

    await userEvent.keyboard("{ArrowLeft}");
    expect(parent).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard("{ArrowRight}");
    expect(parent).toHaveAttribute("aria-expanded", "true");
  });

  it("toggles a branch on click without collapsing its ancestors", async () => {
    render(<ResolutionTree root={RESULT.tree} />);
    const parent = screen.getByRole("treeitem", { name: "document:budget-2026#parent allowed" });
    await userEvent.click(within(parent).getByText("document:budget-2026#parent"));
    expect(parent).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("treeitem", { name: "document:budget-2026#viewer allowed" })).toHaveAttribute("aria-expanded", "true");
  });
});
