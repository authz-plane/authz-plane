import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { acmeVersions } from "../fixtures";
import { specKeys } from "../keys";
import type { SpecDocument } from "../schemas";
import { validateSpecBody } from "../validate";
import { SpecEditorView } from "./spec-editor-view";

const [gen9, gen8] = acmeVersions();

const DOC: SpecDocument = {
  slug: "acme-air",
  generation: 9,
  body: gen9!.body,
  hash: gen9!.hash,
  lineCount: 62,
  updatedAt: gen9!.createdAt,
};

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

/** validate runs the real fixture validator against the request body; PUT is scripted per test. */
function mockFetch(onPut: () => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/spec/validate")) {
      const { body } = JSON.parse(String(init?.body)) as { body: string };
      return json({ ...validateSpecBody(body, { appliedBody: gen8!.body }), durationMs: 41 });
    }
    if (init?.method === "PUT") return onPut();
    return json({ title: "unexpected" }, 500, "application/problem+json");
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderEditor() {
  return renderWithQuery(<SpecEditorView slug="acme-air" />, {
    seed: (client) => client.setQueryData(specKeys.current("acme-air"), DOC),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("SpecEditorView", () => {
  it("renders the topbar, the 62-line editor and the three validation cards with the amber line 15", async () => {
    mockFetch(() => json({}, 500));
    renderEditor();

    expect(screen.getByText("editing → generation 10")).toBeInTheDocument();
    expect(screen.getByText("If-Match: 9")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "tenant.yaml" })).toHaveValue(gen9!.body);
    expect(screen.getByText("62 lines")).toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("schema-caption")).toHaveTextContent("1 warning"));
    const results = screen.getByRole("list", { name: "validation results" });
    const cards = within(results).getAllByRole("listitem");
    expect(cards.map((c) => c.dataset.level)).toEqual(["ok", "warning", "ok"]);
    expect(cards[1]).toHaveTextContent("Secret ref rotates the stored ciphertext");
    expect(cards[1]).toHaveTextContent("line 15 · write-only field, never returned by the API");
    expect(screen.getByRole("status")).toHaveTextContent("POST /spec:validate · 41ms");
    expect(screen.getByText("no changes yet · draft matches generation 9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save new version" })).toBeEnabled();
  });

  it("disables Save while the draft is invalid and re-enables it once fixed", async () => {
    mockFetch(() => json({}, 500));
    renderEditor();
    const save = screen.getByRole("button", { name: "Save new version" });
    await waitFor(() => expect(save).toBeEnabled());

    const textarea = screen.getByRole("textbox", { name: "tenant.yaml" });
    fireEvent.change(textarea, { target: { value: gen9!.body.replace("  slug: acme-air", "   slug: acme-air") } });
    await waitFor(() => expect(screen.getByTestId("schema-caption")).toHaveTextContent("1 error"));
    expect(save).toBeDisabled();
    expect(screen.getByText("unsaved edits")).toBeInTheDocument();
    expect(screen.getByLabelText("change preview")).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: gen9!.body.replace("resyncIntervalSeconds: 600", "resyncIntervalSeconds: 300") } });
    await waitFor(() => expect(screen.getByTestId("schema-caption")).toHaveTextContent("1 warning"));
    expect(save).toBeEnabled();
    expect(screen.getByLabelText("change preview")).toHaveTextContent("resyncIntervalSeconds: 300");
  });

  it("sends PUT with If-Match and an Idempotency-Key and renders a 412 inline", async () => {
    const fetchMock = mockFetch(() =>
      json(
        { status: 412, title: "Spec changed underneath you", detail: "You edited generation 9 but generation 10 is now current · reload and re-diff before saving." },
        412,
        "application/problem+json",
      ),
    );
    renderEditor();
    const save = screen.getByRole("button", { name: "Save new version" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Spec changed underneath you");
    expect(alert).toHaveTextContent("reload and re-diff");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeInTheDocument();

    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(put[0]).toBe("/api/tenants/acme-air/spec");
    const headers = put[1]!.headers as Record<string, string>;
    expect(headers["if-match"]).toBe("9");
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(put[1]!.body))).toEqual({ body: gen9!.body });
  });

  it("reports the new generation and its run after a 202", async () => {
    mockFetch(() => json({ generation: 10, runId: "fedcba987654" }, 202));
    renderEditor();
    const save = screen.getByRole("button", { name: "Save new version" });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);

    const status = await screen.findByText(/saved generation 10/);
    expect(status).toHaveTextContent("reconcile enqueued");
    expect(within(status).getByRole("link", { name: "fedc…54" })).toHaveAttribute("href", "/reconcile-runs/fedcba987654");
  });

  it("switches to the read-only form view", async () => {
    mockFetch(() => json({}, 500));
    renderEditor();
    await userEvent.click(screen.getByRole("tab", { name: "form view" }));
    const form = screen.getByLabelText("form view");
    expect(form).toHaveTextContent("metadata.slug");
    expect(form).toHaveTextContent("acme-air");
    expect(screen.queryByRole("textbox", { name: "tenant.yaml" })).not.toBeInTheDocument();
  });
});
