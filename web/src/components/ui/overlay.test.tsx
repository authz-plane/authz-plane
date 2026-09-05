import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { Drawer, Modal, OverlayHeader } from "./overlay";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} title="Plan">
        body
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is a labelled modal dialog that closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Plan for acme-air">
        <button type="button">Apply</button>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog", { name: "Plan for acme-air" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("moves focus inside and traps Tab within the dialog", async () => {
    render(
      <Modal open onClose={() => {}} title="Trap">
        <button type="button">first</button>
        <button type="button">last</button>
      </Modal>,
    );
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("button", { name: "first" })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "last" })).toHaveFocus();
  });
});

describe("Drawer + OverlayHeader", () => {
  it("closes from the ✕ button", async () => {
    const onClose = vi.fn();
    render(
      <Drawer open onClose={onClose} title="Finding">
        <OverlayHeader title="claimMappings.email changed" onClose={onClose} />
      </Drawer>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "claimMappings.email changed" })).toBeInTheDocument();
  });
});
