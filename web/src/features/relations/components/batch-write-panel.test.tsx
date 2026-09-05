import { describe, expect, it, vi } from "vitest";
import { renderWithQuery, screen, userEvent, waitFor } from "@/test/render";
import { BatchWritePanel } from "./batch-write-panel";

const KEY = "0e1f2a3b-4c5d-6e7f-8091-a2b3c4d5e69b";

function json(body: unknown, status = 200, contentType = "application/json") {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

const noop = () => {};

describe("BatchWritePanel", () => {
  it("labels the primary button from the staged counts and disables it when empty", () => {
    const { rerender } = renderWithQuery(
      <BatchWritePanel
        slug="acme-air"
        staged={{ writes: [], deletes: [] }}
        idempotencyKey={null}
        cachedDecisions={41}
        onAddWrite={noop}
        onUnstage={noop}
        onDiscard={noop}
        onWritten={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Write 0 · delete 0" })).toBeDisabled();
    expect(screen.getByTestId("idempotency-preview")).toHaveTextContent("assigned when the first change is staged");

    rerender(
      <BatchWritePanel
        slug="acme-air"
        staged={{
          writes: [{ user: "user:mira", relation: "auditor", object: "tenant:acme-air" }],
          deletes: [
            { user: "user:dana", relation: "editor", object: "folder:finance" },
            { user: "user:ext-audit", relation: "admin", object: "tenant:acme-air" },
          ],
        }}
        idempotencyKey={KEY}
        cachedDecisions={41}
        onAddWrite={noop}
        onUnstage={noop}
        onDiscard={noop}
        onWritten={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Write 1 · delete 2" })).toBeEnabled();
    expect(screen.getByTestId("idempotency-preview")).toHaveTextContent("0e1f-…-9b");
    expect(screen.getByText("Invalidates 41 cached decisions by tag before returning")).toBeInTheDocument();
    const well = screen.getByLabelText("staged payload");
    expect(well).toHaveTextContent("+ user:mira auditor tenant:acme-air");
    expect(well).toHaveTextContent("− user:dana editor folder:finance");
    expect(screen.getAllByLabelText("delete")).toHaveLength(2);
  });

  it("posts the batch with the batch Idempotency-Key and reports the result", async () => {
    const fetchMock = vi.fn(async () => json({ written: 1, deleted: 2, invalidatedDecisions: 41, modelVersion: 6 }));
    vi.stubGlobal("fetch", fetchMock);
    const onWritten = vi.fn();
    const staged = {
      writes: [{ user: "user:mira", relation: "viewer", object: "folder:ops" }],
      deletes: [
        { user: "user:dana", relation: "editor", object: "folder:finance" },
        { user: "user:ext-audit", relation: "admin", object: "tenant:acme-air" },
      ],
    };
    renderWithQuery(
      <BatchWritePanel
        slug="acme-air"
        staged={staged}
        idempotencyKey={KEY}
        cachedDecisions={41}
        onAddWrite={noop}
        onUnstage={noop}
        onDiscard={noop}
        onWritten={onWritten}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Write 1 · delete 2" }));
    await waitFor(() => expect(onWritten).toHaveBeenCalledWith({ written: 1, deleted: 2, invalidatedDecisions: 41, modelVersion: 6 }));
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/tenants/acme-air/relations/write");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBe(KEY);
    expect(JSON.parse(String(init.body))).toEqual(staged);
    expect(await screen.findByRole("status")).toHaveTextContent("wrote 1 · deleted 2 · invalidated 41 cached decisions");
  });

  it("renders a 400 problem inline and validates the add-write form locally", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(
          { status: 400, title: "Reserved namespace", detail: "platform:* is reserved for the control plane · user:x viewer platform:root rejected" },
          400,
          "application/problem+json",
        ),
      ),
    );
    const onAddWrite = vi.fn();
    renderWithQuery(
      <BatchWritePanel
        slug="acme-air"
        staged={{ writes: [{ user: "user:x", relation: "viewer", object: "platform:root" }], deletes: [] }}
        idempotencyKey={KEY}
        cachedDecisions={41}
        onAddWrite={onAddWrite}
        onUnstage={noop}
        onDiscard={noop}
        onWritten={noop}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Write 1 · delete 0" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("400 · Reserved namespace");

    await userEvent.type(screen.getByLabelText("user"), "raj");
    await userEvent.click(screen.getByRole("button", { name: "Add write" }));
    expect(onAddWrite).not.toHaveBeenCalled();
    expect(screen.getAllByRole("alert").some((el) => el.textContent?.includes("expected user type:id"))).toBe(true);

    await userEvent.clear(screen.getByLabelText("user"));
    await userEvent.type(screen.getByLabelText("user"), "user:raj");
    await userEvent.type(screen.getByLabelText("relation"), "viewer");
    await userEvent.type(screen.getByLabelText("object"), "folder:ops");
    await userEvent.click(screen.getByRole("button", { name: "Add write" }));
    expect(onAddWrite).toHaveBeenCalledWith({ user: "user:raj", relation: "viewer", object: "folder:ops" });
  });
});
