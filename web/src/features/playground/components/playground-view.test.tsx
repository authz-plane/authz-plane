import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, playgroundTenants } from "../fixtures";
import { playgroundKeys, type SubmittedQuery } from "../keys";
import { batchCheck, explain } from "../resolver";
import type { CheckTuple } from "../schemas";
import { PlaygroundView } from "./playground-view";

const NOW = "2026-09-04T10:15:00Z";
const TENANTS = playgroundTenants();
const INITIAL: SubmittedQuery = { ...DEFAULT_QUERY, consistency: "strong", includeProvenance: true };
const INITIAL_RESULT = explain(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, DEFAULT_QUERY, { now: NOW, modelVersion: 6, consistency: "strong" });

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

/** Fixture BFF: answers explain / batch-check from the resolver so results are real. */
function stubFetch() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = new URL(url, "http://console.test");
    const consistency = u.searchParams.get("consistency") === "strong" ? "strong" : "eventual";
    const body = JSON.parse(String(init?.body)) as { checks?: CheckTuple[]; user?: string; relation?: string; object?: string; includeProvenance?: boolean };
    if (u.pathname.endsWith("/batch-check")) {
      return json(batchCheck(ACME_AIR_MODEL_V6, ACME_AIR_TUPLES, body.checks ?? [], { now: NOW, modelVersion: 6, consistency }));
    }
    if (u.pathname.endsWith("/unknown/explain")) return json({ title: "Tenant not found", status: 404 }, 404, "application/problem+json");
    return json(
      explain(
        ACME_AIR_MODEL_V6,
        ACME_AIR_TUPLES,
        { user: body.user!, relation: body.relation!, object: body.object! },
        { now: NOW, modelVersion: 6, consistency, includeProvenance: body.includeProvenance },
      ),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderView() {
  return renderWithQuery(<PlaygroundView tenants={TENANTS} initialQuery={INITIAL} />, {
    seed: (client) => client.setQueryData(playgroundKeys.explain(INITIAL), INITIAL_RESULT),
  });
}

function postsOf(fetchMock: ReturnType<typeof stubFetch>) {
  return (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>).filter(([, i]) => i?.method === "POST");
}

describe("PlaygroundView", () => {
  it("renders the seeded result: chip, meta, tree, decisive card and stats without fetching", () => {
    const fetchMock = stubFetch();
    renderView();
    expect(screen.getByText("ALLOWED").className).toContain("text-ready");
    expect(screen.getByText("7ms · cache miss · model v6 · checkedAt 10:15:00Z")).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Resolution tree" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Decisive tuple" })).toBeInTheDocument();
    expect(screen.getByText("Nodes evaluated").nextElementSibling).toHaveTextContent("5");
    expect(screen.getByText("Max depth").nextElementSibling).toHaveTextContent("3 / 8 cap");
    expect(screen.getByText("bypassed").className).toContain("text-degraded");
    expect(screen.getByText("nothing asked yet this session")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Check & explain POSTs with ?consistency=strong and an Idempotency-Key, then lists the query under RECENT", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.clear(screen.getByLabelText("User"));
    await userEvent.type(screen.getByLabelText("User"), "user:dana");
    await userEvent.click(screen.getByRole("button", { name: "Check & explain" }));

    await waitFor(() => expect(screen.getByText("DENIED")).toBeInTheDocument());
    const [url, init] = postsOf(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/explain?consistency=strong");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(init.body))).toEqual({ user: "user:dana", relation: "viewer", object: "document:budget-2026", includeProvenance: true });

    const recent = screen.getByText("Recent").parentElement!;
    expect(within(recent).getByText("denied").className).toContain("text-failed");
    expect(within(recent).getByText("user:dana viewer document:budget-2026")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Decision" })).toHaveTextContent("Denied · no tuple grants this");
  });

  it("drops the consistency parameter and provenance when the toggles are off", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.click(screen.getByRole("switch", { name: "Consistency: strong" }));
    await userEvent.click(screen.getByRole("switch", { name: "Include tuple provenance" }));
    await userEvent.click(screen.getByRole("button", { name: "Check & explain" }));
    await waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
    const [url, init] = postsOf(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/explain");
    expect(JSON.parse(String(init.body)).includeProvenance).toBe(false);
    await waitFor(() => expect(screen.getByText(/cache hit/)).toBeInTheDocument());
  });

  it("re-runs a recent query on click", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.clear(screen.getByLabelText("User"));
    await userEvent.type(screen.getByLabelText("User"), "user:ana");
    await userEvent.click(screen.getByRole("button", { name: "Check & explain" }));
    await waitFor(() => expect(postsOf(fetchMock)).toHaveLength(1));
    await userEvent.clear(screen.getByLabelText("User"));
    await userEvent.type(screen.getByLabelText("User"), "user:zed");
    await userEvent.click(screen.getByRole("button", { name: /user:ana viewer document:budget-2026/ }));
    await waitFor(() => expect(postsOf(fetchMock)).toHaveLength(2));
    expect(JSON.parse(String(postsOf(fetchMock)[1]![1].body)).user).toBe("user:ana");
    expect(screen.getByLabelText("User")).toHaveValue("user:ana");
  });

  it("batch mode swaps in the textarea, validates lines, and POSTs to batch-check", async () => {
    const fetchMock = stubFetch();
    renderView();
    await userEvent.click(screen.getByRole("switch", { name: "Batch mode" }));
    expect(screen.queryByLabelText("User")).not.toBeInTheDocument();
    const textarea = screen.getByLabelText("Tuples · one per line");

    await userEvent.type(textarea, "user:raj viewer");
    await userEvent.click(screen.getByRole("button", { name: "Check batch" }));
    expect(screen.getByRole("alert")).toHaveTextContent('line 1: expected "user relation object", got 2 fields');
    expect(postsOf(fetchMock)).toHaveLength(0);

    await userEvent.type(textarea, " document:budget-2026\nuser:nobody viewer document:budget-2026");
    await userEvent.click(screen.getByRole("button", { name: "Check batch" }));
    await waitFor(() => expect(screen.getByText("Batch results")).toBeInTheDocument());
    const [url, init] = postsOf(fetchMock)[0]!;
    expect(url).toBe("/api/tenants/acme-air/batch-check?consistency=strong");
    expect(JSON.parse(String(init.body)).checks).toHaveLength(2);
    expect(screen.getByText("1 allowed · 1 denied · model v6")).toBeInTheDocument();
    expect(screen.getByText("BATCH · 2")).toBeInTheDocument();
  });

  it("toggles Raw JSON and copies the request as curl", async () => {
    stubFetch();
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderView();
    await userEvent.click(screen.getByRole("button", { name: "Raw JSON" }));
    expect(screen.getByRole("button", { name: "Raw JSON" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Raw JSON")).toHaveTextContent('"allowed": true');
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Copy as curl" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0]![0]).toContain("/v1/tenants/acme-air/explain?consistency=strong");
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("renders a problem inline when the BFF answers 404", async () => {
    stubFetch();
    renderView();
    await userEvent.selectOptions(screen.getByLabelText("Tenant"), "northwind-rail");
    // Point the fixture at an unknown slug by editing the URL the view builds: swap the tenant list entry.
    vi.mocked(fetch).mockImplementationOnce(async () => json({ title: "Tenant not found", status: 404 }, 404, "application/problem+json"));
    await userEvent.click(screen.getByRole("button", { name: "Check & explain" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("404 · Tenant not found");
  });
});
