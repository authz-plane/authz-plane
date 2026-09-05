import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { dashboardFixture } from "../fixtures";
import { NeedsAttention } from "./needs-attention";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("NeedsAttention", () => {
  it("renders one linked, phase-labelled card per item", () => {
    render(<NeedsAttention items={dashboardFixture("24h", NOW).needsAttention} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(4);
    expect(links[0]).toHaveAttribute("href", "/tenants/northwind-rail");
    expect(links[2]).toHaveAttribute("href", "/drift?tenant=globex-logistics");
    expect(screen.getByText("Failed").className).toContain("text-failed");
    expect(screen.getByText("Drift ×4").className).toContain("text-drift");
    expect(screen.getByText("Applying").className).toContain("text-link");
  });

  it("tints failed/degraded/drift cards but leaves the applying card neutral", () => {
    render(<NeedsAttention items={dashboardFixture("24h", NOW).needsAttention} />);
    const links = screen.getAllByRole("link");
    expect(links[0]!.className).toContain("bg-failed-card-tint");
    expect(links[3]!.className).toContain("border-line");
    expect(links[3]!.className).not.toContain("tint");
  });

  it("shows an all-clear message when there is nothing to attend to", () => {
    render(<NeedsAttention items={[]} />);
    expect(screen.getByText(/Nothing needs attention/)).toBeInTheDocument();
  });
});
