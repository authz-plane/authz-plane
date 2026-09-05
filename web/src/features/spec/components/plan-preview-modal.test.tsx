import { useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { planFixture } from "../fixtures";
import { PlanPreviewModal } from "./plan-preview-modal";

const NOW = new Date("2026-09-04T10:15:00Z");

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockRouter() {
  const push = vi.fn();
  vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() } as unknown as ReturnType<
    typeof useRouter
  >);
  return push;
}

function mockFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method !== "POST") return json({ title: "unexpected method" }, 405);
    if (url.endsWith("?dryRun=true")) return json(planFixture("acme-air", "Acme Air", 10, NOW));
    return json({ runId: "abcdef012345" }, 202);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("PlanPreviewModal", () => {
  it("shows the summary counts, the seven ordered changes and the dashed no-op row", async () => {
    mockRouter();
    mockFetch();
    renderWithQuery(<PlanPreviewModal slug="acme-air" open onClose={vi.fn()} draftBody="apiVersion: authzplane.dev/v1" />);

    expect(await screen.findByRole("heading", { name: "Plan for acme-air · generation 10" })).toBeInTheDocument();
    expect(screen.getByText("pure planner · desired gen 10 vs actual read at 10:14:22Z · no side effects yet")).toBeInTheDocument();

    const summary = screen.getByLabelText("plan summary");
    for (const [n, label] of [
      ["4", "to create"],
      ["2", "to update"],
      ["1", "to delete"],
      ["18", "unchanged"],
    ]) {
      const tile = within(summary).getByText(label!).parentElement!;
      expect(within(tile).getByText(n!)).toBeInTheDocument();
    }

    const list = screen.getByRole("list", { name: "planned changes" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(8);
    expect(rows.filter((r) => r.dataset.op === "create")).toHaveLength(4);
    expect(rows.filter((r) => r.dataset.op === "update")).toHaveLength(2);
    expect(rows.filter((r) => r.dataset.op === "delete")).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("zitadel.org");
    expect(rows[0]).toHaveTextContent('create org "Acme Air"');
    expect(rows[0]).toHaveTextContent("changeKey 3a91…c7");
    expect(rows[7]).toHaveTextContent("18 resources");
    expect(rows[7]).toHaveTextContent("already match desired state — no calls will be made");
    expect(screen.getByText(/ordered by dependency · org → connection → model → tuples/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply 7 changes" })).toBeEnabled();
  });

  it("Apply posts the real reconcile with an Idempotency-Key, closes and navigates to the run", async () => {
    const push = mockRouter();
    const fetchMock = mockFetch();
    const onClose = vi.fn();
    renderWithQuery(<PlanPreviewModal slug="acme-air" open onClose={onClose} />);

    await userEvent.click(await screen.findByRole("button", { name: "Apply 7 changes" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/reconcile-runs/abcdef012345"));
    expect(onClose).toHaveBeenCalled();

    const apply = fetchMock.mock.calls.find(([url]) => url === "/api/tenants/acme-air/reconcile")!;
    expect(apply).toBeDefined();
    const init = apply[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);

    // The plan itself was fetched through the dry-run path, also with a key (the guard requires one on every POST).
    const dry = fetchMock.mock.calls.find(([url]) => url.endsWith("?dryRun=true"))!;
    expect((dry[1] as RequestInit).method).toBe("POST");
    expect(((dry[1] as RequestInit).headers as Record<string, string>)["idempotency-key"]).toBeDefined();
  });

  it("closes on Escape and renders nothing when closed", async () => {
    mockRouter();
    mockFetch();
    const onClose = vi.fn();
    const { rerender } = renderWithQuery(<PlanPreviewModal slug="acme-air" open onClose={onClose} />);
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();

    rerender(<PlanPreviewModal slug="acme-air" open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
