import { describe, expect, it, vi } from "vitest";
import { tenantDetailFixture } from "@/features/tenants/fixtures";
import { renderWithQuery, screen, within } from "@/test/render";
import { acmeIdentityProviders } from "../fixtures";
import { idpKeys } from "../keys";
import type { IdpList } from "../schemas";
import { IdpView } from "./idp-view";

const LIST: IdpList = { slug: "acme-air", items: acmeIdentityProviders(tenantDetailFixture("acme-air")!), specGeneration: 9 };

function renderView(selectedId: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(LIST), { status: 200, headers: { "content-type": "application/json" } })),
  );
  return renderWithQuery(<IdpView slug="acme-air" selectedId={selectedId} />, {
    seed: (client) => client.setQueryData(idpKeys.list("acme-air"), LIST),
  });
}

describe("IdpView", () => {
  it("lists both connections with their state words, facts and the SSRF footer, selecting acme-entra by default", () => {
    renderView(null);
    const nav = screen.getByRole("navigation", { name: "Connections" });
    const entra = within(nav).getByRole("link", { name: /acme-entra/ });
    expect(entra).toHaveAttribute("href", "/tenants/acme-air/identity-providers?idp=acme-entra");
    expect(entra).toHaveAttribute("aria-current", "page");
    expect(entra.className).toContain("border-line-focus");
    expect(within(entra).getByText("pending apply").className).toContain("text-degraded");
    expect(within(entra).getByText("oidc · login.microsoftonline.com")).toBeInTheDocument();
    expect(within(entra).getByText("312 users")).toBeInTheDocument();
    expect(within(entra).getByText("ext 214785_idp1")).toBeInTheDocument();

    const legacy = within(nav).getByRole("link", { name: /acme-legacy-saml/ });
    expect(legacy).not.toHaveAttribute("aria-current");
    expect(legacy.className).toContain("opacity-70");
    expect(within(legacy).getByText("disabled")).toBeInTheDocument();
    expect(within(legacy).getByText("saml · phase 2")).toBeInTheDocument();

    expect(screen.getByText("SSRF guard")).toBeInTheDocument();
    expect(screen.getByText(/https only · DNS resolved and checked against private, loopback, link-local and CGNAT ranges · no redirects · 3s timeout/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Add" })).toHaveAttribute("href", "/tenants/acme-air/spec");
    expect(screen.getByRole("heading", { level: 2, name: "acme-entra" })).toBeInTheDocument();
  });

  it("opens the connection named in ?idp=", () => {
    renderView("acme-legacy-saml");
    expect(screen.getByRole("heading", { level: 2, name: "acme-legacy-saml" })).toBeInTheDocument();
    expect(screen.getByLabelText("Kind")).toHaveValue("saml");
    expect(screen.getByRole("link", { name: /acme-legacy-saml/ })).toHaveAttribute("aria-current", "page");
  });
});
