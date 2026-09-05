import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { dashboardFixture } from "../fixtures";
import { ReconcileOutcomesChart } from "./reconcile-outcomes-chart";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("ReconcileOutcomesChart", () => {
  it("renders twelve columns each described in words, plus a word legend", () => {
    const { outcomes } = dashboardFixture("24h", NOW);
    render(<ReconcileOutcomesChart outcomes={outcomes} />);
    const list = screen.getByRole("list", { name: "Reconcile outcomes per interval" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(12);
    expect(items[2]).toHaveAccessibleName(/16 runs · 14 ready, 2 degraded/);
    expect(items[5]).toHaveAccessibleName(/15 runs · 11 ready, 4 failed/);
    for (const label of ["Ready", "Degraded", "Failed"]) expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("scales the tallest column to the 150px axis and stacks ready at the base", () => {
    const { outcomes } = dashboardFixture("24h", NOW);
    render(<ReconcileOutcomesChart outcomes={outcomes} />);
    const items = screen.getAllByRole("listitem");
    const tallest = items[10]!.firstElementChild as HTMLElement;
    expect(tallest.style.height).toBe("150px");
    const mixed = items[2]!;
    const segments = Array.from(mixed.children) as HTMLElement[];
    expect(segments).toHaveLength(2);
    expect(segments[0]!.className).toContain("bg-degraded");
    expect(segments[1]!.className).toContain("bg-ready");
  });

  it("shows the success rate and run count as a mono caption", () => {
    const { outcomes } = dashboardFixture("24h", NOW);
    render(<ReconcileOutcomesChart outcomes={outcomes} />);
    expect(screen.getByText(/success 96\.7% · 274 runs/)).toBeInTheDocument();
  });
});
