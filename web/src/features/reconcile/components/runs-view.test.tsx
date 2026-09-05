import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, within } from "@/test/render";
import { RUN_IDS } from "../fixtures";
import { listRuns, resetReconcileStoreForTests } from "../server";
import type { RunPage } from "../schemas";
import { RunsView } from "./runs-view";

function mockFetch(page: RunPage) {
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, statusText: "OK", json: async () => page }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => resetReconcileStoreForTests());
afterEach(() => vi.unstubAllGlobals());

describe("RunsView", () => {
  it("renders the stats and one row per run with mono ids linking to the detail", async () => {
    const page = await listRuns({ limit: 25 });
    mockFetch(page);
    renderWithQuery(<RunsView filter={{}} />);

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows.length).toBe(1 + page.items.length);

    expect(screen.getByText("318")).toBeInTheDocument();
    expect(screen.getByText("1.9s")).toBeInTheDocument();
    expect(screen.getByText("71%")).toBeInTheDocument();
    expect(screen.getByText("Retries in backoff")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "8f1c…d2" });
    expect(link).toHaveAttribute("href", `/reconcile-runs/${RUN_IDS.acmePartial}`);
    expect(link.className).toContain("text-link");

    // Outcome words carry their phase tone as text, never colour alone.
    expect(screen.getByText("Partial").className).toContain("text-degraded");
    expect(screen.getByText("Drift").className).toContain("text-drift");
    expect(screen.getAllByText("Failed")[0]?.className).toContain("text-failed");
  });

  it("gives every change bar an accessible caption", async () => {
    const page = await listRuns({ limit: 25 });
    mockFetch(page);
    renderWithQuery(<RunsView filter={{}} />);

    const partial = await screen.findByRole("img", { name: "3 of 5 changes applied, 1 failed" });
    expect(partial.querySelectorAll("[data-outcome]").length).toBe(5);
    expect(within(partial).getByText("3/5")).toBeInTheDocument();

    const drift = screen.getByRole("img", { name: "4 drift findings" });
    expect(drift.querySelectorAll("[data-outcome='drift']").length).toBe(4);
    expect(within(drift).getByText("4 drift")).toBeInTheDocument();

    expect(screen.getByRole("img", { name: /attempt 8 of 8/ })).toBeInTheDocument();
    expect(screen.getByText("attempt 8/8")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /finalizers running/ })).toBeInTheDocument();
    expect(screen.getAllByText("no changes").length).toBeGreaterThan(0);
  });

  it("fetches the tenant-scoped BFF route when a tenant is fixed", async () => {
    const page = await listRuns({ limit: 25, tenant: "acme-air" });
    const fetchMock = mockFetch(page);
    renderWithQuery(<RunsView filter={{ outcome: "NoChanges" }} tenantSlug="acme-air" />);

    await screen.findByRole("table");
    expect(fetchMock).toHaveBeenCalledWith("/api/tenants/acme-air/reconcile-runs?outcome=NoChanges", expect.anything());
    expect(screen.getByText("31")).toBeInTheDocument();
  });

  it("shows the per-table empty copy when there are no runs", async () => {
    const page = await listRuns({ limit: 25 });
    mockFetch({ ...page, items: [] });
    renderWithQuery(<RunsView filter={{}} />);

    expect(await screen.findByRole("heading", { name: "no runs yet" })).toBeInTheDocument();
  });
});
