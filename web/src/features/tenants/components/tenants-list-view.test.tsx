import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, within } from "@/test/render";
import { FIXTURE_NOW, FLEET_BY_PHASE, TENANTS } from "../fixtures";
import { tenantKeys } from "../keys";
import type { TenantListFilter, TenantPage } from "../schemas";
import { TenantsListView } from "./tenants-list-view";

function pageOf(items: TenantPage["items"], overrides: Partial<TenantPage> = {}): TenantPage {
  return {
    items,
    nextCursor: null,
    total: 42,
    counts: { all: 42, byPhase: FLEET_BY_PHASE, withDrift: 3 },
    ...overrides,
  };
}

/** Pills are <a><span>label</span><span>count</span></a>; jsdom joins the spans without a space, so find by label. */
function pill(nav: HTMLElement, label: string): HTMLElement {
  const anchor = within(nav).getByText(label).closest("a");
  if (!anchor) throw new Error(`no pill "${label}"`);
  return anchor;
}

function renderList(filter: TenantListFilter, page: TenantPage) {
  vi.stubGlobal("fetch", vi.fn());
  return renderWithQuery(<TenantsListView filter={filter} now={FIXTURE_NOW} />, {
    seed: (client) => client.setQueryData(tenantKeys.list(filter), page),
  });
}

describe("TenantsListView", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("renders the fixture rows from the hydrated cache with links into each tenant", () => {
    renderList({ limit: 25 }, pageOf(TENANTS));
    expect(fetch).not.toHaveBeenCalled();

    expect(screen.getByRole("link", { name: "Acme Air" })).toHaveAttribute("href", "/tenants/acme-air");
    expect(screen.getByRole("link", { name: "Northwind Rail" })).toHaveAttribute("href", "/tenants/northwind-rail");
    expect(screen.getAllByRole("row")).toHaveLength(TENANTS.length + 1);

    const acme = screen.getByRole("link", { name: "Acme Air" }).closest("[role=row]") as HTMLElement;
    expect(within(acme).getByText("Degraded")).toBeInTheDocument();
    expect(within(acme).getByText("9")).toBeInTheDocument();
    expect(within(acme).getByText("/ obs 8")).toBeInTheDocument();
    expect(within(acme).getByText("Entra ID")).toBeInTheDocument();

    const wayne = screen.getByRole("link", { name: "Wayne Transit" }).closest("[role=row]") as HTMLElement;
    expect(within(wayne).getByText("finalizing")).toBeInTheDocument();

    expect(screen.getByText("showing 7 of 42")).toBeInTheDocument();
  });

  it("filter pills are links into the URL with the fleet counts", () => {
    renderList({ limit: 25 }, pageOf(TENANTS));
    const nav = screen.getByRole("navigation", { name: "Filter tenants" });
    expect(pill(nav, "All")).toHaveAttribute("href", "/tenants");
    expect(pill(nav, "All")).toHaveTextContent("All42");
    expect(pill(nav, "Ready")).toHaveTextContent("Ready38");
    expect(pill(nav, "Ready")).toHaveAttribute("href", "/tenants?phase=Ready");
    expect(pill(nav, "Applying")).toHaveAttribute("href", "/tenants?phase=Applying");
    expect(pill(nav, "Degraded")).toHaveAttribute("href", "/tenants?phase=Degraded");
    expect(pill(nav, "Failed")).toHaveAttribute("href", "/tenants?phase=Failed");
    expect(pill(nav, "Has open drift")).toHaveAttribute("href", "/tenants?drift=1");
    expect(within(nav).getByText("cursor page 1 · 25 per page")).toBeInTheDocument();
  });

  it("marks the active pill, keeps other filters when switching, and pages by cursor", () => {
    const filter: TenantListFilter = { phase: "Ready", q: "air", limit: 25 };
    renderList(filter, pageOf(TENANTS.slice(0, 3), { total: 5, nextCursor: "globex-logistics" }));
    const nav = screen.getByRole("navigation", { name: "Filter tenants" });
    expect(pill(nav, "Ready")).toHaveAttribute("aria-current", "true");
    expect(pill(nav, "Failed")).toHaveAttribute("href", "/tenants?phase=Failed&q=air");

    expect(screen.getByText("showing 3 of 5")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "next →" })).toHaveAttribute(
      "href",
      "/tenants?phase=Ready&q=air&cursor=globex-logistics",
    );
    expect(screen.getByText("← prev")).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the no-match empty state with a clear-filters link when filters hide everything", () => {
    renderList({ phase: "Pending", hasDrift: true, limit: 25 }, pageOf([], { total: 0 }));
    expect(screen.getByRole("heading", { name: "No tenants match" })).toBeInTheDocument();
    expect(screen.getByText(/phase Pending · open drift/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear filters" })).toHaveAttribute("href", "/tenants");
  });

  it("shows the no-tenants-yet empty state for an empty fleet", () => {
    const empty = { Pending: 0, Planning: 0, Applying: 0, Ready: 0, Degraded: 0, Failed: 0, Deleting: 0 };
    renderList({ limit: 25 }, pageOf([], { total: 0, counts: { all: 0, byPhase: empty, withDrift: 0 } }));
    expect(screen.getByRole("heading", { name: "No tenants yet" })).toBeInTheDocument();
    expect(screen.getByText("make seed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New tenant" })).toHaveAttribute("href", "/tenants/new");
  });
});
