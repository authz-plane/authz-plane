import { afterEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_NOW } from "@/features/tenants/fixtures";
import { renderWithQuery, screen, userEvent, waitFor, within } from "@/test/render";
import { driftFixtures } from "../fixtures";
import { driftKeys, RUNS_KEY } from "../keys";
import { FindingDrawer } from "./finding-drawer";

const FINDING = driftFixtures(new Date(FIXTURE_NOW)).find((f) => f.id === "9c1f7e2a")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

describe("FindingDrawer", () => {
  it("renders frame 11: chip, title, provenance, field diff, evidence with the amber conclusion, heal plan and footer note", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderWithQuery(<FindingDrawer finding={FINDING} open onClose={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: "claimMappings.email changed out-of-band" });
    const q = within(dialog);

    expect(q.getByText("high severity · unresolved")).toBeInTheDocument();
    expect(q.getByText("globex-logistics · zitadel.idp/globex-okta · detected 10:08:41Z by resync run a7d3")).toBeInTheDocument();

    expect(q.getByText("Field diff")).toBeInTheDocument();
    expect(q.getByText('claimMappings.email = "email"').className).toContain("break-words");
    expect(q.getByText("desired").nextElementSibling).toHaveTextContent("+");
    expect(q.getByText('claimMappings.email = "upn"')).toBeInTheDocument();
    expect(q.getByText("logins map to a different subject key")).toBeInTheDocument();

    expect(q.getByText("How we found it")).toBeInTheDocument();
    expect(q.getByText("actualStateHash 2f08…9c ≠ lastKnown 8b41…07")).toBeInTheDocument();
    expect(q.getByText("field-level diff produced 4 findings")).toBeInTheDocument();
    expect(q.getByText("no matching audit event in authz-plane → change did not come from us")).toBeInTheDocument();
    expect(q.getByText("likely a direct edit in the Zitadel console").className).toContain("text-degraded");

    expect(q.getByText("Heal plan · 1 change")).toBeInTheDocument();
    expect(q.getByText('set claimMappings.email = "email"')).toBeInTheDocument();
    expect(q.getByText("7b02…14")).toBeInTheDocument();

    expect(q.getByRole("button", { name: "Heal now" })).toBeEnabled();
    expect(q.getByRole("button", { name: "Acknowledge as accepted" })).toBeEnabled();
    expect(q.getByText(/Acknowledging suppresses this exact field path until the desired value changes/)).toBeInTheDocument();
  });

  it("Heal now posts the finding id with an Idempotency-Key, invalidates drift + runs, reports the runs and closes", async () => {
    const fetchMock = vi.fn(async () => json({ runs: [{ tenant: "globex-logistics", runId: "5e1d0a9b3c77" }] }, 202));
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();
    const onHealed = vi.fn();
    const utils = renderWithQuery(<FindingDrawer finding={FINDING} open onClose={onClose} onHealed={onHealed} />);
    const invalidate = vi.spyOn(utils.client, "invalidateQueries");

    await userEvent.click(screen.getByRole("button", { name: "Heal now" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onHealed).toHaveBeenCalledWith([{ tenant: "globex-logistics", runId: "5e1d0a9b3c77" }]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: driftKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: RUNS_KEY });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/drift/heal");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(init.body))).toEqual({ findingIds: ["9c1f7e2a"] });
  });

  it("Acknowledge posts to the finding's acknowledge route and closes", async () => {
    const fetchMock = vi.fn(async () => json({ ...FINDING, status: "acknowledged" }));
    vi.stubGlobal("fetch", fetchMock);
    const onClose = vi.fn();
    renderWithQuery(<FindingDrawer finding={FINDING} open onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Acknowledge as accepted" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/drift/9c1f7e2a/acknowledge");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBeTruthy();
  });

  it("surfaces a problem+json failure inline and stays open", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ title: "Tenant is reconciling", detail: "try again after run 8f1c settles", status: 409 }, 409)));
    const onClose = vi.fn();
    renderWithQuery(<FindingDrawer finding={FINDING} open onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Heal now" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tenant is reconciling");
    expect(screen.getByText("try again after run 8f1c settles")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("disables both actions once a finding is acknowledged", () => {
    vi.stubGlobal("fetch", vi.fn());
    renderWithQuery(<FindingDrawer finding={{ ...FINDING, status: "acknowledged" }} open onClose={() => {}} />);
    expect(screen.getByText("high severity · acknowledged")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heal now" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Acknowledge as accepted" })).toBeDisabled();
  });
});
