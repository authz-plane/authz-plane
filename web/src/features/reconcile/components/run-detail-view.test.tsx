import { useRouter } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { RUN_IDS } from "../fixtures";
import { getRun, resetReconcileStoreForTests } from "../server";
import type { RunDetail } from "../schemas";
import { RunDetailView } from "./run-detail-view";

const NEW_RUN_ID = "abcdef123456";

/** GET returns the run; POST …/retry answers 202 with a new id. */
function mockFetch(run: RunDetail) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST" && url.endsWith("/retry")) {
      return { ok: true, status: 202, statusText: "Accepted", json: async () => ({ runId: NEW_RUN_ID }) };
    }
    return { ok: true, status: 200, statusText: "OK", json: async () => run };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => resetReconcileStoreForTests());
afterEach(() => vi.unstubAllGlobals());

describe("RunDetailView", () => {
  it("renders the header, waterfall bars with aria-labels, and the failure well", async () => {
    const run = (await getRun(RUN_IDS.acmePartial))!;
    mockFetch(run);
    renderWithQuery(<RunDetailView runId={run.id} />);

    // The fallback header also carries the title, so wait for the chip, which only renders with data.
    expect((await screen.findByText("PartiallyApplied")).className).toContain("text-degraded");
    expect(screen.getByRole("heading", { name: "run 8f1c…d2" })).toBeInTheDocument();
    expect(
      screen.getByText("generation 9 · trigger outbox · started 10:14:22Z · 3.4s · traceId 4bf9…a1"),
    ).toBeInTheDocument();

    const waterfall = screen.getByRole("list", { name: "Phase waterfall" });
    const bars = within(waterfall).getAllByRole("img");
    expect(bars.map((b) => b.getAttribute("aria-label"))).toEqual([
      "plan · 180ms",
      "read actual · 640ms",
      "apply 1–3 · 1.1s",
      "change 4 timeout · 3.0s",
    ]);
    expect(bars[3]?.className).toContain("bg-failed");

    const changes = screen.getByRole("list", { name: "Changes" });
    const items = within(changes).getAllByRole("listitem");
    expect(items.length).toBe(5);
    expect(items[3]?.className).toContain("border-failed-border-strong");
    expect(items[3]?.className).toContain("bg-failed-tint-deep");
    expect(within(items[3]!).getByText("problem+json · type: /errors/downstream-timeout")).toBeInTheDocument();
    expect(within(items[3]!).getByText(/attempt 3 of 8 · next 45s \(jittered\)/)).toBeInTheDocument();
    expect(
      within(items[3]!).getByText("detail: OpenFGA WriteTuples exceeded 3000ms budget; circuit half-open"),
    ).toBeInTheDocument();
    expect(items[4]?.className).toContain("border-dashed");
    expect(within(items[4]!).getByText("skipped — run aborted after failure")).toBeInTheDocument();

    expect(screen.getByText("idempotent hit")).toBeInTheDocument();
    expect(screen.getByText("new external id")).toBeInTheDocument();
  });

  it("renders run facts and the worker log with the closing lines", async () => {
    const run = (await getRun(RUN_IDS.acmePartial))!;
    mockFetch(run);
    renderWithQuery(<RunDetailView runId={run.id} />);

    await screen.findByRole("heading", { name: "Run facts" });
    expect(screen.getByText("held 3.4s").className).toContain("text-ready");
    expect(screen.getByText("reconciler-0")).toBeInTheDocument();
    expect(screen.getByText("r2://…/8f1c.json")).toBeInTheDocument();
    expect(screen.getByText("2f08…9c").closest("dd")?.className).toContain("text-degraded");

    expect(screen.getByText(/phase Degraded, retry at 10:15:12/)).toBeInTheDocument();
    expect(screen.getByText(/lock released, msg requeued/)).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: /live/ })).not.toBeInTheDocument();
  });

  it("links to the trace in a new tab and offers the snapshot", async () => {
    const run = (await getRun(RUN_IDS.acmePartial))!;
    mockFetch(run);
    renderWithQuery(<RunDetailView runId={run.id} />);

    const trace = await screen.findByRole("link", { name: /Open trace/ });
    expect(trace).toHaveAttribute("href", run.traceUrl);
    expect(trace).toHaveAttribute("target", "_blank");
    expect(trace.getAttribute("rel")).toContain("noopener");
    expect(screen.getByRole("button", { name: "Pre-apply snapshot" })).toBeEnabled();
  });

  it("Retry run POSTs with an Idempotency-Key and navigates to the new run", async () => {
    const push = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push, replace: vi.fn() } as unknown as ReturnType<typeof useRouter>);
    const run = (await getRun(RUN_IDS.acmePartial))!;
    const fetchMock = mockFetch(run);
    renderWithQuery(<RunDetailView runId={run.id} />);

    const button = await screen.findByRole("button", { name: "Retry run" });
    expect(button).toBeEnabled();
    await userEvent.click(button);

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/reconcile-runs/${NEW_RUN_ID}`));
    const retryCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(retryCall?.[0]).toBe(`/api/reconcile-runs/${RUN_IDS.acmePartial}/retry`);
    const headers = retryCall?.[1]?.headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("disables Retry and flags the log as live while the run is in flight", async () => {
    const run = (await getRun(RUN_IDS.initechLive))!;
    mockFetch(run);
    renderWithQuery(<RunDetailView runId={run.id} />);

    expect(await screen.findByRole("button", { name: "Retry run" })).toBeDisabled();
    expect(screen.getByText("Applying")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("live · polling 1s");
    expect(screen.getByText(/running 1\.6s/)).toBeInTheDocument();
  });
});
