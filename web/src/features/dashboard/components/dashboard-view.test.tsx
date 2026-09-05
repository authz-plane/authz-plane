import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, waitFor } from "@/test/render";
import { dashboardFixture } from "../fixtures";
import { dashboardKeys } from "../keys";
import { DashboardView } from "./dashboard-view";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("DashboardView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders from a hydrated cache without fetching first", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<DashboardView window="24h" />, {
      seed: (client) => client.setQueryData(dashboardKeys.overview("24h"), dashboardFixture("24h", NOW)),
    });
    expect(screen.getByText("Reconcile outcomes")).toBeInTheDocument();
    expect(screen.getByText("Needs attention")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/dashboard with the window when the cache is cold", async () => {
    const data = dashboardFixture("6h", NOW);
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(data), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    renderWithQuery(<DashboardView window="6h" />);
    await waitFor(() => expect(screen.getByText("Reconcile outcomes")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith("/api/dashboard?window=6h", expect.anything());
  });

  it("shows the problem title when the first fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ title: "Not signed in", status: 401 }), { status: 401 })),
    );
    renderWithQuery(<DashboardView window="24h" />);
    await waitFor(() => expect(screen.getByText("Not signed in")).toBeInTheDocument());
    expect(screen.getByText("Overview unavailable")).toBeInTheDocument();
  });
});
