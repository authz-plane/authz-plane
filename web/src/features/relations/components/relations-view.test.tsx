import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { acmeTuples } from "../fixtures";
import { PLAYGROUND_KEY, relationsKeys } from "../keys";
import type { RelationsPage } from "../schemas";
import { RelationsView } from "./relations-view";

const ALL = acmeTuples();
const PAGE1: RelationsPage = { items: ALL.slice(0, 6), nextCursor: "c6", total: 1284, modelVersion: 6, cachedDecisions: 41 };
const PAGE2: RelationsPage = { items: ALL.slice(6), nextCursor: null, total: 1284, modelVersion: 6, cachedDecisions: 41 };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function stubFetch(onWrite: (init: RequestInit) => Response = () => json({ written: 0, deleted: 0, invalidatedDecisions: 41, modelVersion: 6 })) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return onWrite(init);
    return json(url.includes("cursor=c6") ? PAGE2 : PAGE1);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView() {
  const utils = renderWithQuery(<RelationsView slug="acme-air" filter={{}} />);
  utils.client.setQueryData(relationsKeys.list("acme-air", {}), { pages: [PAGE1], pageParams: [undefined] });
  return utils;
}

describe("RelationsView", () => {
  it("renders page one, the topbar meta, the drift row and the cursor footer", async () => {
    stubFetch();
    renderView();
    expect(await screen.findByText("1 284 tuples · model v6")).toBeInTheDocument();
    // The Table primitive puts aria-label on its scroll wrapper, so query the role alone.
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(7); // header + 6
    const drift = within(table).getByText("drift · unmanaged").closest("[role=row]")!;
    expect(drift.className).toContain("bg-drift-tint");
    expect(within(table).getByText("parent").className).toContain("text-degraded");
    expect(within(table).getAllByText("Aug 30 09:12Z")).toHaveLength(1);
    expect(screen.getByText(/1 278 more · cursor paginated, tenant_id-leading index/)).toBeInTheDocument();
  });

  it("loads the next page through the cursor and stops at the end", async () => {
    const fetchMock = stubFetch();
    renderView();
    await screen.findByText("1 284 tuples · model v6");
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13));
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tenants/acme-air/relations?cursor=c6")).toBe(true);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByText(/1 272 more/)).toBeInTheDocument();
  });

  it("stages deletes from the row menu and writes from the panel, updating the button label", async () => {
    stubFetch();
    renderView();
    await screen.findByText("1 284 tuples · model v6");
    expect(screen.getByRole("button", { name: "Write 0 · delete 0" })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "actions for user:dana editor folder:finance" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "stage delete" }));
    expect(screen.getByRole("button", { name: "Write 0 · delete 1" })).toBeEnabled();
    expect(screen.getByTestId("idempotency-preview")).toHaveTextContent(/^[0-9a-f]{4}-…-[0-9a-f]{2}$/);

    // The filter row also labels inputs user/relation/object; scope to the panel's form.
    const addForm = within(screen.getByRole("form", { name: "Add a write" }));
    await userEvent.type(addForm.getByLabelText("user"), "user:mira");
    await userEvent.type(addForm.getByLabelText("relation"), "viewer");
    await userEvent.type(addForm.getByLabelText("object"), "folder:ops");
    await userEvent.click(addForm.getByRole("button", { name: "Add write" }));
    expect(screen.getByRole("button", { name: "Write 1 · delete 1" })).toBeEnabled();

    // Re-opening the menu for a staged row shows it as already staged.
    await userEvent.click(screen.getByRole("button", { name: "actions for user:dana editor folder:finance" }));
    expect(screen.getByRole("menuitem", { name: "staged for delete" })).toBeDisabled();
  });

  it("posts the batch with an Idempotency-Key, then refetches relations and invalidates playground keys", async () => {
    const fetchMock = stubFetch(() => json({ written: 0, deleted: 1, invalidatedDecisions: 41, modelVersion: 6 }));
    const utils = renderView();
    const invalidate = vi.spyOn(utils.client, "invalidateQueries");
    await screen.findByText("1 284 tuples · model v6");

    await userEvent.click(screen.getByRole("button", { name: "actions for user:dana editor folder:finance" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "stage delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Write 0 · delete 1" }));

    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PLAYGROUND_KEY }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: relationsKeys.all("acme-air") });
    const post = (fetchMock.mock.calls as unknown as Array<[string, RequestInit | undefined]>).find(([, i]) => i?.method === "POST")!;
    expect(post[0]).toBe("/api/tenants/acme-air/relations/write");
    expect((post[1]!.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      writes: [],
      deletes: [{ user: "user:dana", relation: "editor", object: "folder:finance" }],
    });
    // Batch cleared after success; the row itself is only removed by the refetch, never optimistically.
    expect(screen.getByRole("button", { name: "Write 0 · delete 0" })).toBeDisabled();
  });
});
