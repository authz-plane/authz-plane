import { usePathname, useRouter } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { acmeVersions } from "../fixtures";
import { specKeys } from "../keys";
import type { SpecVersions } from "../schemas";
import { nextSelection, resolveSelection, SpecHistoryView } from "./spec-history-view";

const VERSIONS: SpecVersions = {
  slug: "acme-air",
  items: acmeVersions(),
  total: 9,
  currentGeneration: 9,
  observedGeneration: 8,
};

const PATH = "/tenants/acme-air/spec/versions";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function mockRouter() {
  const replace = vi.fn();
  vi.mocked(usePathname).mockReturnValue(PATH);
  vi.mocked(useRouter).mockReturnValue({ push: vi.fn(), replace, back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() } as unknown as ReturnType<
    typeof useRouter
  >);
  return replace;
}

function renderHistory(props: { a?: number; b?: number } = {}) {
  return renderWithQuery(<SpecHistoryView slug="acme-air" {...props} />, {
    seed: (client) => client.setQueryData(specKeys.versions("acme-air"), VERSIONS),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("resolveSelection / nextSelection", () => {
  const items = acmeVersions();

  it("defaults to the current generation against the one before it", () => {
    expect(resolveSelection(items, 9)).toEqual({ a: 8, b: 9 });
    expect(resolveSelection(items, 9, 5, 7)).toEqual({ a: 5, b: 7 });
    expect(resolveSelection(items, 9, 7, 5)).toEqual({ a: 5, b: 7 });
    expect(resolveSelection(items, 9, 42, 9)).toEqual({ a: 8, b: 9 });
  });

  it("makes a click older than B side A, and a click newer than B the new B", () => {
    expect(nextSelection({ a: 8, b: 9 }, 7)).toEqual({ a: 7, b: 9 });
    expect(nextSelection({ a: 5, b: 7 }, 9)).toEqual({ a: 7, b: 9 });
    expect(nextSelection({ a: 8, b: 9 }, 8)).toEqual({ a: 8, b: 9 });
  });
});

describe("SpecHistoryView", () => {
  it("renders the version list with A/B badges, the header chips and the two panes", () => {
    mockRouter();
    renderHistory();

    expect(screen.getByText("9 total")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "versions" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(9);
    expect(within(list).getByRole("button", { name: "gen 9 · side B" })).toHaveAttribute("aria-pressed", "true");
    expect(within(list).getByRole("button", { name: "gen 8 · side A" })).toHaveAttribute("aria-pressed", "true");
    expect(within(list).getByText("ci-bot (m2m) · 2026-08-30 09:00")).toBeInTheDocument();
    expect(within(list).getByText("ops@acme-air.test · 2026-09-04 10:02")).toBeInTheDocument();

    expect(screen.getByText("A gen 8")).toBeInTheDocument();
    expect(screen.getByText("B gen 9")).toBeInTheDocument();
    expect(screen.getByTestId("changed-fields")).toHaveTextContent("4 changed fields");
    expect(screen.getByText("GEN 8 · APPLIED, CONVERGED")).toBeInTheDocument();
    expect(screen.getByText("GEN 9 · CURRENT DESIRED")).toBeInTheDocument();

    const left = screen.getByLabelText("side A · gen 8");
    const right = screen.getByLabelText("side B · gen 9");
    // Testing Library's default normaliser trims the leading indentation.
    expect(within(left).getByText("clientSecretRef: acme-entra-old")).toBeInTheDocument();
    expect(within(right).getByText("clientSecretRef: acme-entra-secret")).toBeInTheDocument();
    expect(within(left).getAllByLabelText("removed").length).toBeGreaterThan(0);
    expect(within(right).getAllByLabelText("added").length).toBeGreaterThan(0);
    // Secrets appear as refs only.
    expect(screen.queryByText(/clientSecret:/)).not.toBeInTheDocument();
  });

  it("writes the A/B selection to the URL when a version is clicked", async () => {
    const replace = mockRouter();
    renderHistory();
    await userEvent.click(screen.getByRole("button", { name: "gen 7" }));
    expect(replace).toHaveBeenCalledWith(`${PATH}?a=7&b=9`, { scroll: false });
  });

  it("honours ?a=&b= from the URL", () => {
    mockRouter();
    renderHistory({ a: 5, b: 7 });
    expect(screen.getByText("A gen 5")).toBeInTheDocument();
    expect(screen.getByText("B gen 7")).toBeInTheDocument();
    expect(screen.getByText("GEN 7 · SUPERSEDED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore gen 5 as new version" })).toBeEnabled();
  });

  it("toggles the unified view", async () => {
    mockRouter();
    renderHistory();
    await userEvent.click(screen.getByRole("button", { name: "Unified" }));
    expect(screen.getByLabelText("unified diff")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Side by side" })).toHaveAttribute("aria-pressed", "true");
  });

  it("restores gen A as a new generation through the restore route with an Idempotency-Key", async () => {
    mockRouter();
    const fetchMock = vi.fn(async () => json({ generation: 10, runId: "0011aabbccdd" }, 202));
    vi.stubGlobal("fetch", fetchMock);
    renderHistory();

    await userEvent.click(screen.getByRole("button", { name: "Restore gen 8 as new version" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("gen 8 restored as generation 10 · history untouched"));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tenants/acme-air/spec/versions/8/restore");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
