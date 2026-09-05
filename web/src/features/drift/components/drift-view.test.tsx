import { useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_NOW } from "@/features/tenants/fixtures";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { driftFixtures } from "../fixtures";
import { driftKeys, RUNS_KEY } from "../keys";
import type { DriftList } from "../schemas";
import { DriftView } from "./drift-view";

const NOW = new Date(FIXTURE_NOW);
const ITEMS = driftFixtures(NOW);

function page(items = ITEMS): DriftList {
  return {
    generatedAt: FIXTURE_NOW,
    items,
    stats: { open: items.length, tenantsAffected: new Set(items.map((f) => f.tenant)).size, oldestUnresolvedSeconds: items.length ? 15_120 : null, healedToday: 19 },
    lastResyncAt: "2026-09-04T10:11:00Z",
    resyncIntervalSeconds: 600,
    tenants: ["acme-air", "globex-logistics", "umbrella-health"],
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const router = { push: vi.fn(), replace: vi.fn() };

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("severity=high") as never);
});
afterEach(() => vi.unstubAllGlobals());

function renderView(data = page(), openFindingId?: string) {
  return renderWithQuery(<DriftView filter={{}} basePath="/drift" openFindingId={openFindingId} />, {
    seed: (client) => {
      client.setQueryData(driftKeys.list({}), data);
      if (openFindingId) client.setQueryData(driftKeys.finding(openFindingId), data.items.find((f) => f.id === openFindingId));
    },
  });
}

describe("DriftView", () => {
  it("renders the topbar meta, the four stats and every row with the right action", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();
    expect(screen.getByText("7 open findings · resync every 600s, jittered")).toBeInTheDocument();
    expect(screen.getByText("Open findings").nextElementSibling).toHaveTextContent("7");
    expect(screen.getByText("Tenants affected").nextElementSibling).toHaveTextContent("3");
    expect(screen.getByText("Oldest unresolved").nextElementSibling).toHaveTextContent("4h 12m");
    expect(screen.getByText("Healed today").nextElementSibling).toHaveTextContent("19");

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(8); // header + 7
    // globex (autoHeal off) heals by hand, acme (autoHeal on, run known) links to the reconcile, low severity acks.
    expect(within(table).getAllByRole("link", { name: /^Heal finding/ })).toHaveLength(4);
    expect(within(table).getAllByRole("link", { name: /^View reconcile run/ })).toHaveLength(2);
    expect(within(table).getByRole("button", { name: "Acknowledge finding f20d4a6b" })).toBeInTheDocument();
    expect(within(table).getByRole("link", { name: "Heal finding 9c1f7e2a" })).toHaveAttribute("href", "/drift/9c1f7e2a?severity=high");
    expect(within(table).getByText('"email"').className).toContain("text-ready");
    expect(within(table).getByText('"upn"').className).toContain("text-failed");
    expect(screen.getByRole("button", { name: "Heal 0 selected" })).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Selection actions" })).not.toBeInTheDocument();
  });

  it("selecting rows updates the Heal label, tints the row and shows the sticky footer", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();
    const first = screen.getByRole("checkbox", { name: "Select finding 9c1f7e2a" });
    await userEvent.click(first);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select finding 3a6f2d91" }));

    expect(screen.getByRole("button", { name: "Heal 2 selected" })).toBeEnabled();
    expect(first.closest("[role=row]")!.className).toContain("bg-drift-tint");
    const footer = screen.getByRole("region", { name: "Selection actions" });
    expect(footer).toHaveTextContent("2 selected · healing enqueues one reconcile per tenant and closes findings on convergence");
    expect(within(footer).getByRole("button", { name: "Heal selected" })).toBeInTheDocument();

    await userEvent.click(first);
    expect(screen.getByRole("button", { name: "Heal 1 selected" })).toBeEnabled();
  });

  it("Heal N selected posts the ids with an Idempotency-Key, invalidates drift + runs and clears the selection", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") return json({ runs: [{ tenant: "globex-logistics", runId: "0f3a9c1e77b2" }] }, 202);
      return json(page(ITEMS.filter((f) => f.id !== "9c1f7e2a")));
    });
    vi.stubGlobal("fetch", fetchMock);
    const utils = renderView();
    const invalidate = vi.spyOn(utils.client, "invalidateQueries");

    await userEvent.click(screen.getByRole("checkbox", { name: "Select finding 9c1f7e2a" }));
    await userEvent.click(screen.getByRole("button", { name: "Heal 1 selected" }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: driftKeys.all }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: RUNS_KEY });
    const post = (fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>).find(([, i]) => i?.method === "POST")!;
    expect(post[0]).toBe("/api/drift/heal");
    expect((post[1]!.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(post[1]!.body))).toEqual({ findingIds: ["9c1f7e2a"] });
    expect(await screen.findByRole("status")).toHaveTextContent("healing enqueued · 1 reconcile: globex-logistics 0f3a");
    expect(screen.getByRole("button", { name: "Heal 0 selected" })).toBeDisabled();
  });

  it("opens the route-addressable drawer on row click, keeping the search params", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView();
    await userEvent.click(within(screen.getByRole("table")).getByText("claimMappings.email"));
    expect(router.push).toHaveBeenCalledWith("/drift/9c1f7e2a?severity=high");
  });

  it("renders the drawer for the open finding and closes back to the list with its params", async () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView(page(), "9c1f7e2a");
    const dialog = screen.getByRole("dialog", { name: "claimMappings.email changed out-of-band" });
    expect(dialog).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(router.push).toHaveBeenCalledWith("/drift?severity=high");
  });

  it("shows the empty copy with the last resync age when nothing is open", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderView(page([]));
    expect(screen.getByText("no open drift — last resync 4m ago")).toBeInTheDocument();
    expect(screen.getByText("0 open findings · resync every 600s, jittered")).toBeInTheDocument();
  });

  it("tenant scope builds ?finding= drawer links and hides the tenant select", () => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    const globex = ITEMS.filter((f) => f.tenant === "globex-logistics");
    renderWithQuery(
      <DriftView filter={{ tenant: "globex-logistics" }} scopedTenant="globex-logistics" basePath="/tenants/globex-logistics/drift" />,
      { seed: (client) => client.setQueryData(driftKeys.list({ tenant: "globex-logistics" }), page(globex)) },
    );
    expect(screen.queryByRole("combobox", { name: "Filter by tenant" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Heal finding 9c1f7e2a" })).toHaveAttribute("href", "/tenants/globex-logistics/drift?finding=9c1f7e2a");
  });
});
