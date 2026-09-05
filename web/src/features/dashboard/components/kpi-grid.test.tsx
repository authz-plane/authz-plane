import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { dashboardFixture } from "../fixtures";
import { KpiGrid } from "./kpi-grid";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("KpiGrid", () => {
  it("renders the four tiles with the fixture values", () => {
    render(<KpiGrid data={dashboardFixture("24h", NOW)} />);
    expect(screen.getByText("Converged")).toBeInTheDocument();
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("/42")).toBeInTheDocument();
    expect(screen.getByText(/SLO < 30s · within budget/)).toBeInTheDocument();
    expect(screen.getByText("7").className).toContain("text-drift");
    expect(screen.getByText("across 3 tenants")).toBeInTheDocument();
    expect(screen.getByText("worker keeping up")).toBeInTheDocument();
  });

  it("exposes the converged bar as a meter", () => {
    render(<KpiGrid data={dashboardFixture("24h", NOW)} />);
    const meter = screen.getByRole("meter", { name: "Tenants converged" });
    expect(meter).toHaveAttribute("aria-valuenow", "38");
    expect(meter).toHaveAttribute("aria-valuemax", "42");
    expect((meter.firstElementChild as HTMLElement).style.width).toBe("90%");
  });

  it("flips the SLO and outbox captions when budgets are exceeded", () => {
    const d = dashboardFixture("24h", NOW);
    d.convergenceLag.p95Seconds = 45;
    d.outbox.lagSeconds = 12;
    d.drift.open = 0;
    render(<KpiGrid data={d} />);
    expect(screen.getByText(/over budget/).className).toContain("text-degraded");
    expect(screen.getByText("worker falling behind")).toBeInTheDocument();
    expect(screen.getByText("no open findings")).toBeInTheDocument();
  });
});
