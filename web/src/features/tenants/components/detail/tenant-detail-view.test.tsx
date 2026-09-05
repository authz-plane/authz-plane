import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { RunListFilterSchema, type RunSummary } from "@/features/reconcile/schemas";
import { listRuns, resetReconcileStoreForTests } from "@/features/reconcile/server";
import { FIXTURE_NOW, tenantDetailFixture } from "@/features/tenants/fixtures";
import { tenantKeys } from "@/features/tenants/keys";
import type { TenantDetail } from "@/features/tenants/schemas";
import { TenantDetailView } from "./tenant-detail-view";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** GET returns the tenant projection; POST …/reconcile returns 202. */
function mockFetch(tenant: TenantDetail) {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "POST") return json({ runId: "0123456789ab" }, 202);
    return json(tenant);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function acmeRuns(): Promise<RunSummary[]> {
  return (await listRuns(RunListFilterSchema.parse({ tenant: "acme-air", limit: 5 }))).items;
}

function renderDetail(tenant: TenantDetail, runs: RunSummary[]) {
  return renderWithQuery(<TenantDetailView slug={tenant.slug} runs={runs} now={FIXTURE_NOW} />, {
    seed: (client) => client.setQueryData(tenantKeys.detail(tenant.slug), tenant),
  });
}

beforeEach(() => resetReconcileStoreForTests());
afterEach(() => vi.unstubAllGlobals());

describe("TenantDetailView · acme-air (Degraded)", () => {
  it("renders the header, the not-converged strip with a countdown, the stat tiles and the two cards", async () => {
    const tenant = tenantDetailFixture("acme-air")!;
    mockFetch(tenant);
    renderDetail(tenant, await acmeRuns());

    expect(screen.getByRole("heading", { level: 1, name: "Acme Air" })).toBeInTheDocument();
    expect(screen.getByText("tenant:9f2c1a · org 214785 · created 2026-06-14")).toBeInTheDocument();

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Not converged · generation 9, observed 8");
    expect(screen.getByTestId("not-converged-detail")).toHaveTextContent(
      "OpenFGA WriteTuples timed out after 3000ms · attempt 3 of 8 · next retry in 45s",
    );
    expect(within(alert).getByRole("link", { name: "View run" })).toHaveAttribute("href", "/reconcile-runs/8f1c9e4b27d2");

    expect(screen.getByText("specHash b7e2…04")).toBeInTheDocument();
    expect(screen.getByText("lag 96s")).toBeInTheDocument();
    expect(screen.getByText("1 284")).toBeInTheDocument();
    expect(screen.getByText("model v6")).toBeInTheDocument();
    expect(screen.getByText("resync every 600s")).toBeInTheDocument();

    // Lifecycle: Degraded is current and says so in words.
    const chain = screen.getByRole("list", { name: "lifecycle" });
    const current = within(chain).getByText("Degraded");
    expect(current).toHaveAttribute("aria-current", "step");
    expect(within(chain).getByText("current")).toBeInTheDocument();
    expect(within(chain).getAllByRole("listitem")).toHaveLength(5);

    // Recent runs link to the run detail.
    const runs = screen.getByRole("list", { name: "recent runs" });
    const first = within(runs).getByRole("link", { name: /run 8f1c · gen 9 · outbox/ });
    expect(first).toHaveAttribute("href", "/reconcile-runs/8f1c9e4b27d2");
    expect(first).toHaveTextContent("PartiallyApplied");

    // Desired state summary + drift footer.
    expect(screen.getByText("312 mirrored")).toBeInTheDocument();
    expect(screen.getByText("2 open drift findings on this tenant")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review →" })).toHaveAttribute("href", "/tenants/acme-air/drift");
    expect(screen.getByRole("link", { name: "Dry-run plan" })).toHaveAttribute("href", "/?plan=1");
    expect(screen.getByRole("link", { name: "Edit spec" })).toHaveAttribute("href", "/tenants/acme-air/spec");
  });

  it("ticks the countdown locally after mount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      const tenant = tenantDetailFixture("acme-air")!;
      mockFetch(tenant);
      renderDetail(tenant, []);
      expect(screen.getByTestId("not-converged-detail")).toHaveTextContent("next retry in 45s");
      act(() => {
        vi.advanceTimersByTime(3_000);
      });
      expect(screen.getByTestId("not-converged-detail")).toHaveTextContent("next retry in 42s");
      act(() => {
        vi.advanceTimersByTime(50_000);
      });
      expect(screen.getByTestId("not-converged-detail")).toHaveTextContent("retrying now");
    } finally {
      vi.useRealTimers();
    }
  });

  it("posts Reconcile now with an Idempotency-Key and shows the enqueued run inline", async () => {
    const tenant = tenantDetailFixture("acme-air")!;
    const fetchMock = mockFetch(tenant);
    renderDetail(tenant, await acmeRuns());

    await userEvent.click(screen.getByRole("button", { name: "Reconcile now" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("reconcile enqueued"));

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(post[0]).toBe("/api/tenants/acme-air/reconcile");
    const headers = post[1]!.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(screen.getByRole("link", { name: "0123…ab" })).toHaveAttribute("href", "/reconcile-runs/0123456789ab");
  });
});

describe("TenantDetailView · northwind-rail (Failed)", () => {
  it("renders the terminal-failure card in place of the strip with the three actions", async () => {
    const tenant = tenantDetailFixture("northwind-rail")!;
    mockFetch(tenant);
    renderDetail(tenant, []);

    const card = screen.getByRole("alert");
    expect(card).toHaveTextContent("northwind-rail is Failed");
    expect(card).toHaveTextContent("8 of 8 attempts exhausted over 24m");
    expect(card).toHaveTextContent("400 invalid_idp_config");
    expect(within(card).getByRole("link", { name: "Fix spec & reconcile" })).toHaveAttribute("href", "/tenants/northwind-rail/spec");
    expect(within(card).getByRole("link", { name: "Open failed run" })).toHaveAttribute("href", "/reconcile-runs/2c77e0b9a413");
    expect(within(card).getByRole("button", { name: "Reconcile anyway" })).toBeEnabled();
    expect(screen.queryByText(/Not converged/)).not.toBeInTheDocument();

    const chain = screen.getByRole("list", { name: "lifecycle" });
    expect(within(chain).getByText("Failed")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("no runs yet")).toBeInTheDocument();
  });
});
