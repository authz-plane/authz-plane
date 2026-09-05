import { describe, expect, it, vi } from "vitest";
import { tenantDetailFixture } from "@/features/tenants/fixtures";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { acmeIdentityProviders } from "../fixtures";
import { idpKeys } from "../keys";
import { probeIssuer } from "../probe";
import type { ProbeRequestInput } from "../schemas";
import { ConnectionForm } from "./connection-form";

const ACME = tenantDetailFixture("acme-air")!;
const [ENTRA, LEGACY] = acmeIdentityProviders(ACME);

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function stubFetch(onPatch: (init: RequestInit) => Response = () => json({ id: "acme-entra", generation: 10, stagedAt: "2026-09-04T10:15:00Z", secretReplaced: false }, 202)) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PATCH") return onPatch(init);
    if (init?.method === "POST" && url.endsWith("/test")) {
      const body = JSON.parse(String(init.body)) as ProbeRequestInput;
      return json(probeIssuer(body.issuer, body.kind));
    }
    return json({});
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const probeStatus = () => screen.getByRole("status", { name: "issuer probe" });

function calls(fetchMock: ReturnType<typeof stubFetch>, method: string) {
  return (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).filter(([, i]) => i?.method === method);
}

describe("ConnectionForm", () => {
  it("renders the frame's fields and never a secret value; replace reveals an empty password input", async () => {
    stubFetch();
    const { container } = renderWithQuery(<ConnectionForm slug="acme-air" idp={ENTRA!} specGeneration={9} />);
    expect(screen.getByRole("heading", { level: 2, name: "acme-entra" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("acme-entra");
    expect(screen.getByLabelText("Kind")).toHaveValue("oidc");
    expect(screen.getByLabelText("Issuer")).toHaveValue(ENTRA!.issuer);
    expect(screen.getByLabelText("Issuer").className).toContain("border-ready-border-strong");
    expect(probeStatus()).toHaveTextContent("discovery ok · 240ms");
    expect(screen.getByLabelText("Client ID")).toHaveValue("4f1c9a2e-77b1-4c3d-9e8f-0a1b2c3d4e5f");

    // Write-only secret: a mask, a "replace" affordance, and no password input anywhere.
    const masked = screen.getByRole("group", { name: "Client secret · stored, never shown" });
    expect(masked).toHaveTextContent("••••••••••••••••");
    expect(masked.className).toContain("border-degraded-border-strong");
    expect(container.querySelector('input[type="password"]')).toBeNull();
    expect(screen.getByText("· write-only").className).toContain("text-degraded");

    await userEvent.click(screen.getByRole("button", { name: "replace" }));
    const secret = screen.getByLabelText(/Client secret/);
    expect(secret).toHaveAttribute("type", "password");
    expect(secret).toHaveValue("");
    expect(secret).toHaveAttribute("autocomplete", "new-password");
    expect(screen.queryByRole("group", { name: /stored, never shown/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "keep current" }));
    expect(container.querySelector('input[type="password"]')).toBeNull();

    // Claim mappings and the probe card.
    const table = screen.getByRole("table", { name: "Claim mappings" });
    expect(within(table).getAllByRole("row")).toHaveLength(5);
    expect(within(table).getByText("preferred_username")).toBeInTheDocument();
    expect(within(table).getByText("oid")).toBeInTheDocument();
    const card = screen.getByLabelText("Discovery probe result");
    expect(within(card).getAllByText("ok")).toHaveLength(4);
    expect(within(card).getByText("resolved IP is public · 20.190.x.x")).toBeInTheDocument();
    expect(screen.getByText(/edits desired state only.*generation 10\./)).toBeInTheDocument();
  });

  it("shows an empty password input straight away when no secret is stored", () => {
    stubFetch();
    renderWithQuery(<ConnectionForm slug="acme-air" idp={LEGACY!} specGeneration={9} />);
    const secret = screen.getByLabelText(/Client secret/);
    expect(secret).toHaveAttribute("type", "password");
    expect(secret).toHaveValue("");
    expect(secret).toHaveAttribute("placeholder", "not set");
    expect(screen.queryByRole("button", { name: "replace" })).not.toBeInTheDocument();
    expect(screen.getByText("not probed yet · Test discovery runs the SSRF-guarded probe")).toBeInTheDocument();
  });

  it("probes the issuer on blur and shows a blocked result inline", async () => {
    const fetchMock = stubFetch();
    renderWithQuery(<ConnectionForm slug="acme-air" idp={ENTRA!} specGeneration={9} />);
    const issuer = screen.getByLabelText("Issuer");
    await userEvent.clear(issuer);
    await userEvent.type(issuer, "http://10.0.0.4/oidc");
    expect(probeStatus()).toHaveTextContent("probes on blur");
    await userEvent.tab();

    await waitFor(() => expect(probeStatus()).toHaveTextContent("blocked by SSRF guard"));
    expect(issuer.className).toContain("border-failed-border-strong");
    expect(issuer).toHaveAttribute("aria-invalid", "true");
    const [url, init] = calls(fetchMock, "POST")[0]!;
    expect(url).toBe("/api/tenants/acme-air/identity-providers/acme-entra/test");
    expect(JSON.parse(String(init.body))).toEqual({ issuer: "http://10.0.0.4/oidc", kind: "oidc" });
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBeTruthy();
    const card = screen.getByLabelText("Discovery probe result");
    expect(within(card).getByText("http refused · https only")).toBeInTheDocument();
    expect(within(card).getByText("failed")).toBeInTheDocument();

    // Blurring again with the same issuer does not re-probe.
    await userEvent.click(issuer);
    await userEvent.tab();
    expect(calls(fetchMock, "POST")).toHaveLength(1);
  });

  it("Stage into spec PATCHes the draft with an Idempotency-Key, includes the secret only when replaced, and reports generation 10", async () => {
    const fetchMock = stubFetch(() => json({ id: "acme-entra", generation: 10, stagedAt: "2026-09-04T10:15:00Z", secretReplaced: true }, 202));
    const utils = renderWithQuery(<ConnectionForm slug="acme-air" idp={ENTRA!} specGeneration={9} />);
    utils.client.setQueryData(idpKeys.list("acme-air"), { slug: "acme-air", items: [ENTRA, LEGACY], specGeneration: 9 });
    const invalidate = vi.spyOn(utils.client, "invalidateQueries");

    await userEvent.click(screen.getByRole("button", { name: "Stage into spec" }));
    await waitFor(() => expect(calls(fetchMock, "PATCH")).toHaveLength(1));
    let [url, init] = calls(fetchMock, "PATCH")[0]!;
    expect(url).toBe("/api/tenants/acme-air/identity-providers/acme-entra");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(init.body))).toEqual({ name: "acme-entra", kind: "oidc", issuer: ENTRA!.issuer, clientId: ENTRA!.clientId });
    expect(await screen.findByText("Staged into generation 10")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: idpKeys.all("acme-air") });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tenant", "acme-air"] });

    await userEvent.click(screen.getByRole("button", { name: "replace" }));
    await userEvent.type(screen.getByLabelText(/Client secret/), "new-secret-value");
    await userEvent.click(screen.getByRole("button", { name: "Stage into spec" }));
    await waitFor(() => expect(calls(fetchMock, "PATCH")).toHaveLength(2));
    [url, init] = calls(fetchMock, "PATCH")[1]!;
    expect(JSON.parse(String(init.body)).clientSecret).toBe("new-secret-value");
    // After staging, the mask is back and the typed value is gone from the DOM.
    await waitFor(() => expect(screen.getByRole("group", { name: /stored, never shown/ })).toBeInTheDocument());
    expect(document.body.innerHTML).not.toContain("new-secret-value");
    expect(screen.getByText(/secret replaced/)).toBeInTheDocument();
  });

  it("renders a problem inline when staging fails", async () => {
    stubFetch(() => json({ title: "Issuer rejected", status: 422, detail: "blocked by SSRF guard: resolved address is loopback · refused" }, 422, "application/problem+json"));
    renderWithQuery(<ConnectionForm slug="acme-air" idp={ENTRA!} specGeneration={9} />);
    await userEvent.click(screen.getByRole("button", { name: "Stage into spec" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("422 · Issuer rejected");
    expect(screen.getByText(/resolved address is loopback/)).toBeInTheDocument();
  });
});
