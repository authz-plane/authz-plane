import { useRouter } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor } from "@/test/render";
import { acmeRoles } from "../fixtures";
import { rolesKeys } from "../keys";
import type { RolesResponse } from "../schemas";
import { RolesView } from "./roles-view";

const ROLES: RolesResponse = { slug: "acme-air", items: acmeRoles(), specGeneration: 9 };

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function stubFetch(onMutate: (url: string, init: RequestInit) => Response) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!init?.method || init.method === "GET") return json(ROLES);
    return onMutate(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView(initialRole: string | null = null) {
  const utils = renderWithQuery(<RolesView slug="acme-air" initialRole={initialRole} />);
  utils.client.setQueryData(rolesKeys.list("acme-air"), ROLES);
  return utils;
}

describe("RolesView", () => {
  it("shows the meta, selects the staged role by default and inspects it", async () => {
    stubFetch(() => json({}));
    renderView();
    expect(await screen.findByText("4 roles · spec-owned")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "tenant_auditor" })).toBeInTheDocument();
    expect(screen.getByText("spec gen 10 · staged")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in spec editor" })).toHaveAttribute("href", "/tenants/acme-air/spec");
    expect(screen.getByText(/tenant_auditor is bound to 0 tuples/)).toBeInTheDocument();
  });

  it("puts the selected role in the URL and switches the inspector", async () => {
    stubFetch(() => json({}));
    const replace = vi.fn();
    vi.mocked(useRouter).mockReturnValue({
      replace,
      push: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as unknown as ReturnType<typeof useRouter>);
    renderView();
    await screen.findByText("4 roles · spec-owned");
    await userEvent.click(screen.getByRole("row", { name: /tenant_admin/ }));
    expect(replace).toHaveBeenCalledWith("/?role=tenant_admin");
    expect(screen.getByRole("heading", { level: 2, name: "tenant_admin" })).toBeInTheDocument();
    expect(screen.getByText("tenant_admin is bound to 14 tuples. Deleting it returns 409 until those relations are removed.")).toBeInTheDocument();
  });

  it("renders the 409 problem inline when deleting a bound role", async () => {
    const fetchMock = stubFetch(() =>
      json(
        {
          type: "about:blank",
          status: 409,
          title: "Role is bound to tuples",
          detail: "tenant_admin is bound to 14 tuples. Remove those relations before deleting the role.",
        },
        409,
        "application/problem+json",
      ),
    );
    renderView("tenant_admin");
    await screen.findByRole("heading", { level: 2, name: "tenant_admin" });
    await userEvent.click(screen.getByRole("button", { name: "Delete role" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("409 · Role is bound to tuples");
    expect(screen.getByText(/Remove those relations before deleting the role/)).toBeInTheDocument();
    const call = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).find(([, i]) => i?.method === "DELETE")!;
    expect(call[0]).toBe("/api/tenants/acme-air/roles/tenant_admin");
    expect((call[1].headers as Record<string, string>)["idempotency-key"]).toBeTruthy();
    // 409 keeps the row: nothing was removed.
    expect(screen.getByRole("row", { name: /tenant_admin/ })).toBeInTheDocument();
  });

  it("refetches after a 202 delete and the removed row disappears", async () => {
    let roles = ROLES;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        roles = { ...roles, items: roles.items.filter((r) => r.key !== "tenant_legacy_ops") };
        return json({ key: "tenant_legacy_ops", generation: 10, stagedAt: "2026-09-04T10:15:00Z" }, 202);
      }
      return json(roles);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderView("tenant_legacy_ops");
    await screen.findByRole("heading", { level: 2, name: "tenant_legacy_ops" });
    await userEvent.click(screen.getByRole("button", { name: "Delete role" }));
    await waitFor(() => expect(screen.queryByRole("row", { name: /tenant_legacy_ops/ })).not.toBeInTheDocument());
    expect(screen.getByText("3 roles · spec-owned")).toBeInTheDocument();
  });
});
