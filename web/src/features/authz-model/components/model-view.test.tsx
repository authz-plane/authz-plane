import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor } from "@/test/render";
import { ACME_CACHED_DECISIONS, ACME_DRAFT_DSL_V7, ACME_LIVE_DSL_V6, ACME_VERSIONS } from "../fixtures";
import { authzModelKeys } from "../keys";
import type { AuthorizationModel } from "../schemas";
import { AuthorizationModelView } from "./model-view";

const MODEL: AuthorizationModel = {
  slug: "acme-air",
  liveVersion: 6,
  draftVersion: 7,
  live: ACME_LIVE_DSL_V6,
  draft: ACME_DRAFT_DSL_V7,
  versions: ACME_VERSIONS,
  tupleCount: 1284,
  cachedDecisions: ACME_CACHED_DECISIONS,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** fetch stub: GET serves the model (the query refetches on mount), mutations get `onMutate`. */
function stubFetch(onMutate: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") return json(MODEL);
    return onMutate(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function mutationCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return (fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>).filter(
    ([, init]) => init?.method && init.method !== "GET",
  );
}

function renderView() {
  const utils = renderWithQuery(<AuthorizationModelView slug="acme-air" />);
  utils.client.setQueryData(authzModelKeys.model("acme-air"), MODEL);
  return utils;
}

describe("AuthorizationModelView", () => {
  it("renders the chip, the parse caption and the type graph from the seeded cache", async () => {
    stubFetch(() => json({}));
    renderView();
    expect(await screen.findByText("v6 live · editing v7")).toBeInTheDocument();
    expect(screen.getByText("parses · 3 types · 8 relations · depth 3")).toBeInTheDocument();
    expect(screen.getByText("5 relations")).toBeInTheDocument();
    expect(screen.getByText("3 relations")).toBeInTheDocument();
    expect(screen.getByText("new in v7")).toBeInTheDocument();
    expect(screen.getByText(/1 284 existing tuples validate against v7/)).toBeInTheDocument();
  });

  it("posts the draft to /validate with an Idempotency-Key and shows the result inline", async () => {
    const fetchMock = stubFetch(() =>
      json({ ok: true, types: 3, relations: 8, depth: 3, issues: [], tuplesValidated: 1284, elapsedMs: 38 }),
    );
    renderView();
    await screen.findByText("v6 live · editing v7");
    await userEvent.click(screen.getByRole("button", { name: "Validate DSL" }));

    await waitFor(() => expect(mutationCalls(fetchMock)).toHaveLength(1));
    const [url, init] = mutationCalls(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/authorization-model/validate");
    expect(init!.method).toBe("POST");
    expect((init!.headers as Record<string, string>)["idempotency-key"]).toMatch(/[0-9a-f-]{36}/);
    expect(JSON.parse(String(init!.body))).toEqual({ dsl: ACME_DRAFT_DSL_V7 });
    expect(await screen.findByText("DSL parses · 3 types · 8 relations · depth 3")).toBeInTheDocument();
    expect(screen.getByText(/POST \/authorization-model\/validate · 38ms/)).toBeInTheDocument();
  });

  it("stages into the next generation and reports it inline", async () => {
    const fetchMock = stubFetch(() => json({ generation: 10, version: 7, stagedAt: "2026-09-04T10:15:00Z" }, 202));
    renderView();
    await screen.findByText("v6 live · editing v7");
    await userEvent.click(screen.getByRole("button", { name: "Stage into spec" }));
    expect(await screen.findByText(/staged into generation 10/)).toBeInTheDocument();
    const [url, init] = mutationCalls(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/authorization-model");
    expect(init!.method).toBe("POST");
  });

  it("opens the version history drawer listing v1..v7", async () => {
    stubFetch(() => json({}));
    renderView();
    await screen.findByText("v6 live · editing v7");
    await userEvent.click(screen.getByRole("button", { name: "Version history" }));
    const dialog = screen.getByRole("dialog", { name: "Model version history" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("v7")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("2026-08-21 09:30Z")).toBeInTheDocument();
  });

  it("recomputes the caption from local edits and flags a broken draft", async () => {
    stubFetch(() => json({}));
    renderView();
    await screen.findByText("v6 live · editing v7");
    await userEvent.click(screen.getByRole("button", { name: "Edit" }));
    const editor = screen.getByLabelText("model.fga draft");
    await userEvent.clear(editor);
    // "[[" is user-event's escape for a literal "[".
    await userEvent.type(
      editor,
      "model{enter}  schema 1.1{enter}type user{enter}type doc{enter}  relations{enter}    define v: [[user] or nope",
    );
    expect(screen.getByText("1 issue · line 6")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stage into spec" })).toBeDisabled();
  });
});
