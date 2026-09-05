import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { AUDIT_EVENTS } from "../fixtures";
import { auditKeys } from "../keys";
import type { AuditPage } from "../schemas";
import { AuditView } from "./audit-view";

const ACME = AUDIT_EVENTS.filter((e) => e.tenant === "acme-air");
const ACTORS = [...new Map(ACME.map((e) => [e.actor.id, e.actor])).values()];
const PAGE1: AuditPage = { generatedAt: "2026-09-04T10:15:00Z", items: ACME.slice(0, 8), nextCursor: "c8", total: 2418, actors: ACTORS };
const PAGE2: AuditPage = { ...PAGE1, items: ACME.slice(8), nextCursor: null };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(onPost: () => Response = () => json({ exportId: "exp_7a1c2e9b04", status: "queued", format: "ndjson.gz" }, 202)) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return onPost();
    return json(url.includes("cursor=c8") ? PAGE2 : PAGE1);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const router = { push: vi.fn(), replace: vi.fn() };

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  vi.mocked(usePathname).mockReturnValue("/tenants/acme-air/audit-events");
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("action=SpecUpdated") as never);
});
afterEach(() => vi.unstubAllGlobals());

function renderView(initialEventId?: string) {
  return renderWithQuery(<AuditView filter={{}} scopedTenant="acme-air" initialEventId={initialEventId} />, {
    seed: (client) => client.setQueryData(auditKeys.list("acme-air", {}), { pages: [PAGE1], pageParams: [undefined] }),
  });
}

describe("AuditView", () => {
  it("renders the topbar meta, the rows in phase colours and the index footer", () => {
    stubFetch();
    renderView();
    expect(screen.getByText("append-only · acme-air · 2 418 events")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(9); // header + 8
    expect(within(table).getByText("ReconcileDegraded").className).toContain("text-degraded");
    expect(within(table).getByText("SpecUpdated").className).toContain("text-link");
    expect(within(table).getAllByText("DriftDetected")[0]!.className).toContain("text-drift");
    expect(within(table).getByText("RelationsWritten").className).toContain("text-ready");
    expect(within(table).getByText("IdpSecretRotated").className).toContain("text-failed");
    expect(within(table).getByText("ci-bot (m2m)")).toBeInTheDocument();
    expect(within(table).getAllByText("system:reconciler").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("4bf9…a1")).toHaveLength(2);
    expect(within(table).getByText("10:14:22Z")).toBeInTheDocument();
    expect(screen.getByText(/index: \(tenant_id, occurred_at DESC\) · no UPDATE or DELETE grant on this table/)).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Tenant" })).not.toBeInTheDocument();
  });

  it("selects the first row by default and swaps the panel's BEFORE / AFTER when another row is clicked", async () => {
    stubFetch();
    renderView();
    let panel = screen.getByRole("region", { name: /^Event / });
    expect(within(panel).getByText("run 8f1c9e4b27d2 → Degraded at change 4")).toBeInTheDocument();

    await userEvent.click(within(screen.getByRole("table")).getByText("tenant:acme-air gen 9"));

    panel = screen.getByRole("region", { name: "Event evt_01k4a9wz7q" });
    expect(within(panel).getByText("tenant:acme-air → generation 9")).toBeInTheDocument();
    expect(within(panel).getByText(/ops@acme-air\.test · human ·/)).toHaveTextContent("ops@acme-air.test · human · 10:14:22.481Z");
    expect(within(panel).getByText("Before / after")).toBeInTheDocument();
    expect(within(panel).getByText("roles: [tenant_admin, tenant_viewer]")).toBeInTheDocument();
    expect(within(panel).getByText("roles: [tenant_admin, tenant_viewer, tenant_auditor]")).toBeInTheDocument();
    expect(within(panel).getByText("relations: 5 entries")).toBeInTheDocument();
    expect(within(panel).getByText("relations: 4 entries")).toBeInTheDocument();
    expect(within(panel).getAllByLabelText("removed")).toHaveLength(2);
    expect(within(panel).getAllByLabelText("added")).toHaveLength(2);
    // Context facts + the redaction note + footer actions.
    expect(within(panel).getByText("requestId").nextElementSibling).toHaveTextContent("4bf9…a1");
    expect(within(panel).getByRole("link", { name: /open/ })).toHaveAttribute("href", expect.stringContaining("4bf9e2c7d81a03b6f5a1"));
    expect(within(panel).getByText("82.14.x.x")).toBeInTheDocument();
    expect(within(panel).getByText("b7e21f04")).toBeInTheDocument();
    expect(within(panel).getByRole("note")).toHaveTextContent("Secret values are redacted before persistence");
    expect(within(panel).getByRole("link", { name: "Show related run" })).toHaveAttribute("href", "/reconcile-runs/8f1c9e4b27d2");
    // The selection mirrors into the URL, keeping the existing filters.
    expect(router.replace).toHaveBeenCalledWith("/tenants/acme-air/audit-events?action=SpecUpdated&event=evt_01k4a9wz7q");
    expect(screen.getByRole("row", { selected: true })).toHaveTextContent("tenant:acme-air gen 9");
  });

  it("honours ?event= for the initial selection", () => {
    stubFetch();
    renderView("evt_01k4a7x9nd");
    const panel = screen.getByRole("region", { name: "Event evt_01k4a7x9nd" });
    expect(within(panel).getByText("idp:acme-entra client secret rotated")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "No related run" })).toBeDisabled();
  });

  it("loads older events through the cursor and stops at the end", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Load older" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(15)); // header + 14
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tenants/acme-air/audit-events?cursor=c8")).toBe(true);
    expect(screen.queryByRole("button", { name: "Load older" })).not.toBeInTheDocument();
    expect(screen.getByText(/fixture materialises 14 rows/)).toBeInTheDocument();
  });

  it("Export NDJSON.gz posts with an Idempotency-Key and shows the queued export id inline", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Export NDJSON.gz" }));
    expect(await screen.findByRole("status")).toHaveTextContent("export queued · exp_7a1c2e9b04 · ndjson.gz");
    const post = (fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>).find(([, i]) => i?.method === "POST")!;
    expect(post[0]).toBe("/api/tenants/acme-air/audit-exports");
    expect((post[1]!.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("filter pills write to the URL and drop the selected event", async () => {
    stubFetch();
    renderView();
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Filter by actor" }), "ci-bot");
    expect(router.replace).toHaveBeenCalledWith("/tenants/acme-air/audit-events?action=SpecUpdated&actor=ci-bot");
  });

  it("platform scope adds the TENANT column and the tenant pill, and disables export until a tenant is chosen", () => {
    stubFetch();
    vi.mocked(usePathname).mockReturnValue("/audit");
    const platform: AuditPage = { ...PAGE1, items: AUDIT_EVENTS.slice(0, 8), total: 9731 };
    renderWithQuery(<AuditView filter={{}} tenants={["acme-air", "globex-logistics"]} />, {
      seed: (client) => client.setQueryData(auditKeys.list(null, {}), { pages: [platform], pageParams: [undefined] }),
    });
    expect(screen.getByText("append-only · all tenants · 9 731 events")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Tenant" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Filter by tenant" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export NDJSON.gz" })).toBeDisabled();
  });
});
