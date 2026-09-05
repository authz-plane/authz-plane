import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { acmeUsers } from "../fixtures";
import { usersKeys } from "../keys";
import type { UsersPage } from "../schemas";
import { UsersView } from "./users-view";

const ALL = acmeUsers("2026-09-04T10:15:00Z");
const BASE = {
  total: 312,
  userCount: 312,
  lastRefreshedAt: "2026-09-04T10:12:00Z",
  lastRefreshRunId: "71a0c3d9e5f2",
  asOf: "2026-09-04T10:15:00Z",
  stagedGeneration: 10,
  inviteRoles: ["tenant_admin", "tenant_editor", "tenant_viewer", "tenant_auditor"],
};
const PAGE1: UsersPage = { ...BASE, items: ALL.slice(0, 8), nextCursor: "c8" };
const PAGE2: UsersPage = { ...BASE, items: ALL.slice(8), nextCursor: null };

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function stubFetch(onPost: (url: string, init: RequestInit) => Response = () => json({}, 202)) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") return onPost(url, init);
    return json(url.includes("cursor=c8") ? PAGE2 : PAGE1);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function posts(fetchMock: ReturnType<typeof stubFetch>) {
  return (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).filter(([, i]) => i?.method === "POST");
}

function renderView(filter: { q?: string } = {}) {
  return renderWithQuery(<UsersView slug="acme-air" filter={filter} />, {
    seed: (client) => client.setQueryData(usersKeys.list("acme-air", filter), { pages: [PAGE1], pageParams: [undefined] }),
  });
}

describe("UsersView", () => {
  it("renders the topbar, caption with the resync-run link, eight rows and the footer", () => {
    stubFetch();
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    expect(screen.getByText("read-only mirror")).toBeInTheDocument();
    expect(screen.getByText(/312 users · last refreshed 3m ago by resync run/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "71a0" })).toHaveAttribute("href", "/reconcile-runs/71a0c3d9e5f2");
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(9);
    expect(screen.getByText(/staged in generation 10, not yet applied · user records are owned by the IdP, never edited here/)).toBeInTheDocument();
    expect(screen.getByText("304 more")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search email or subject" })).toHaveValue("");
  });

  it("loads the next page through the cursor and then hides Load more", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(17));
    expect(fetchMock.mock.calls.some(([url]) => String(url) === "/api/tenants/acme-air/users?cursor=c8")).toBe(true);
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.getByText("296 more")).toBeInTheDocument();
  });

  it("puts the search term in ?q= on submit", async () => {
    stubFetch();
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ replace, push: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() } as unknown as ReturnType<typeof useRouter>);
    renderView();
    await userEvent.type(screen.getByRole("searchbox", { name: "Search email or subject" }), "vendor{Enter}");
    expect(replace).toHaveBeenCalledWith("/?q=vendor");
  });

  it("Refresh from IdP POSTs with an Idempotency-Key, shows the enqueued run and invalidates users + runs", async () => {
    const fetchMock = stubFetch(() => json({ runId: "71a0c3d9e5f2", enqueuedAt: "2026-09-04T10:15:00Z" }, 202));
    const utils = renderView();
    const invalidate = vi.spyOn(utils.client, "invalidateQueries");
    await userEvent.click(screen.getByRole("button", { name: "Refresh from IdP" }));
    expect(await screen.findByRole("status")).toHaveTextContent("resync enqueued · run 71a0 refreshes the mirror");
    const [url, init] = posts(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/users/refresh");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(init.body).toBeUndefined();
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: usersKeys.all("acme-air") }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["runs"] });
  });

  it("Invite user opens a dialog whose form POSTs email + role and reports the 202", async () => {
    const fetchMock = stubFetch((url) =>
      url.endsWith("/invite")
        ? json({ inviteId: "inv_0123456789ab", email: "new.person@acme-air.test", role: "tenant_auditor", expiresAt: "2026-09-11T10:15:00Z" }, 202)
        : json({}, 202),
    );
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Invite user" }));
    const dialog = screen.getByRole("dialog", { name: "Invite user" });
    expect(screen.getByRole("button", { name: "Send invite" })).toBeDisabled();

    await userEvent.type(within(dialog).getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(within(dialog).getByText(/Invalid email/i)).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);

    await userEvent.clear(within(dialog).getByLabelText("Email"));
    await userEvent.type(within(dialog).getByLabelText("Email"), "New.Person@acme-air.test");
    await userEvent.selectOptions(within(dialog).getByLabelText("Role"), "tenant_auditor");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));

    expect(await within(dialog).findByText("Invite sent to new.person@acme-air.test")).toBeInTheDocument();
    const [url, init] = posts(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/users/invite");
    expect(JSON.parse(String(init.body))).toEqual({ email: "New.Person@acme-air.test", role: "tenant_auditor" });
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders a 409 problem inside the drawer", async () => {
    stubFetch(() => json({ title: "Already a member", status: 409, detail: "ana.ruiz@acme-air.test is already in the mirror or has a pending invite." }, 409, "application/problem+json"));
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Invite user" }));
    const dialog = screen.getByRole("dialog", { name: "Invite user" });
    await userEvent.type(within(dialog).getByLabelText("Email"), "ana.ruiz@acme-air.test");
    await userEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("409 · Already a member");
  });

  it("shows the empty search state with a clear link", () => {
    stubFetch();
    renderWithQuery(<UsersView slug="acme-air" filter={{ q: "zzz" }} />, {
      seed: (client) =>
        client.setQueryData(usersKeys.list("acme-air", { q: "zzz" }), { pages: [{ ...BASE, items: [], nextCursor: null, total: 0 }], pageParams: [undefined] }),
    });
    expect(screen.getByText("No users match this search")).toBeInTheDocument();
    expect(screen.getByText(/0 matches for/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Clear search" })).toHaveAttribute("href", "/tenants/acme-air/users");
  });
});
