import { useRouter, useSearchParams } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { NewTenantWizard } from "./new-tenant-wizard";

const router = { push: vi.fn(), replace: vi.fn() };
const OPTIONS = [
  { slug: "acme-air", displayName: "Acme Air" },
  { slug: "globex-logistics", displayName: "Globex Logistics" },
];

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

/** Fixture BFF: slug-check says acme-air is taken; POST creates unless the body says otherwise. */
function stubBff(post: (body: Record<string, unknown>) => Response = (body) => json({ ...CREATED, slug: body.slug }, 201)) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("/api/tenants/slug-check")) {
      const slug = new URL(url, "http://localhost").searchParams.get("slug");
      return slug === "acme-air" ? json({ available: false, reason: "taken" }) : json({ available: true });
    }
    if (url === "/api/tenants" && init?.method === "POST") return post(JSON.parse(String(init.body)) as Record<string, unknown>);
    return json({ title: "Not found", status: 404 }, 404, "application/problem+json");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const CREATED = {
  id: "7a1b2c",
  slug: "vertex-freight",
  displayName: "Vertex Freight",
  phase: "Pending",
  generation: 1,
  observedGeneration: 0,
  openDrift: 0,
  lastReconciledAt: null,
  idp: null,
  autoHeal: false,
  resyncIntervalSeconds: 600,
  createdAt: "2026-09-04T10:15:00.000Z",
  orgId: null,
  specHash: "0badf00d",
};

function setStep(step: string | null) {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(step ? `step=${step}` : "") as never);
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue(router as unknown as ReturnType<typeof useRouter>);
  setStep(null);
  vi.spyOn(window.history, "pushState").mockImplementation(() => {});
  vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NewTenantWizard · identity", () => {
  it("derives the slug from the display name, checks availability, and only then enables Continue", async () => {
    const fetchMock = stubBff();
    renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);

    const name = screen.getByLabelText("Display name");
    expect(name).toHaveFocus();
    const slug = screen.getByLabelText(/^Slug/);
    const next = screen.getByRole("button", { name: "Continue to authorization" });
    expect(next).toBeDisabled();

    await userEvent.type(name, "Vertex Freight");
    expect(slug).toHaveValue("vertex-freight");
    expect(next).toBeDisabled();

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("available"), { timeout: 2000 });
    expect(fetchMock).toHaveBeenCalledWith("/api/tenants/slug-check?slug=vertex-freight", expect.anything());
    expect(next).toBeEnabled();

    // Live spec preview follows the form.
    const preview = screen.getByLabelText("Spec preview");
    expect(preview).toHaveTextContent("slug: vertex-freight");
    expect(preview).toHaveTextContent("displayName: Vertex Freight");
    expect(preview).toHaveTextContent("autoHeal: false");
    expect(preview).toHaveTextContent("resyncIntervalSeconds: 600");

    await userEvent.click(next);
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/tenants/new?step=authorization");
  });

  it("reports a taken slug and keeps Continue disabled; an edited slug stops following the name", async () => {
    stubBff();
    renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);
    await userEvent.type(screen.getByLabelText("Display name"), "Acme Air");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("taken"), { timeout: 2000 });
    expect(screen.getByRole("button", { name: "Continue to authorization" })).toBeDisabled();

    const slug = screen.getByLabelText(/^Slug/);
    await userEvent.clear(slug);
    await userEvent.type(slug, "acme-air-2");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("available"), { timeout: 2000 });
    await userEvent.type(screen.getByLabelText("Display name"), " Ltd");
    expect(slug).toHaveValue("acme-air-2");
  });

  it("validates the slug locally before asking the server", async () => {
    const fetchMock = stubBff();
    renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);
    await userEvent.type(screen.getByLabelText(/^Slug/), "ab");
    expect(screen.getByRole("status")).toHaveTextContent("at least 3 characters");
    await new Promise((r) => setTimeout(r, 500));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toggles auto-heal and shows the copy-from picker with the tenant options", async () => {
    stubBff();
    renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);
    await userEvent.click(screen.getByRole("switch", { name: "Auto-heal drift" }));
    expect(screen.getByLabelText("Spec preview")).toHaveTextContent("autoHeal: true");

    await userEvent.click(screen.getByRole("radio", { name: /Copy from tenant/ }));
    const picker = screen.getByRole("combobox", { name: "Source tenant" });
    expect(within(picker).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "pick a tenant…",
      "acme-air · Acme Air",
      "globex-logistics · Globex Logistics",
    ]);
  });
});

describe("NewTenantWizard · authorization and review", () => {
  async function fillIdentity() {
    const view = renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);
    await userEvent.type(screen.getByLabelText("Display name"), "Vertex Freight");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("available"), { timeout: 2000 });
    return view;
  }

  it("a deep link into review with no data falls back to identity and rewrites the URL", () => {
    stubBff();
    setStep("review");
    renderWithQuery(<NewTenantWizard tenantOptions={OPTIONS} />);
    expect(screen.getByRole("heading", { name: "Identity" })).toBeInTheDocument();
    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "/tenants/new");
  });

  it("creates the tenant with an Idempotency-Key and navigates to it", async () => {
    const fetchMock = stubBff();
    const { rerender } = await fillIdentity();

    setStep("authorization");
    rerender(<NewTenantWizard tenantOptions={OPTIONS} />);
    expect(screen.getByRole("heading", { name: "Authorization" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Documents starter/ }));
    expect(screen.getByLabelText("Spec preview")).toHaveTextContent("starter: documents");
    await userEvent.click(screen.getByRole("button", { name: "Continue to review" }));
    expect(window.history.pushState).toHaveBeenCalledWith(null, "", "/tenants/new?step=review");

    setStep("review");
    rerender(<NewTenantWizard tenantOptions={OPTIONS} />);
    expect(screen.getByRole("heading", { name: "Review plan" })).toBeInTheDocument();
    expect(screen.getByLabelText("Generation 1 spec")).toHaveTextContent("- key: tenant_editor");

    await userEvent.click(screen.getByRole("button", { name: "Create tenant" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/tenants/vertex-freight"));

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(post).toBeDefined();
    const [url, init] = post as [string, RequestInit];
    expect(url).toBe("/api/tenants");
    const headers = init.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["content-type"]).toBe("application/json");
    expect(JSON.parse(String(init.body))).toEqual({
      displayName: "Vertex Freight",
      slug: "vertex-freight",
      startFrom: "blank",
      starterModel: "documents",
      autoHeal: false,
      resyncIntervalSeconds: 600,
    });
  });

  it("renders a 409 problem inline and stays on review", async () => {
    stubBff(() =>
      json(
        { status: 409, title: "Slug already taken", detail: 'A tenant with slug "vertex-freight" already exists. Slugs are immutable, pick another.' },
        409,
        "application/problem+json",
      ),
    );
    const { rerender } = await fillIdentity();
    setStep("review");
    rerender(<NewTenantWizard tenantOptions={OPTIONS} />);

    await userEvent.click(screen.getByRole("button", { name: "Create tenant" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("409 · Slug already taken");
    expect(alert).toHaveTextContent("Slugs are immutable, pick another.");
    expect(router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create tenant" })).toBeEnabled();
  });
});
