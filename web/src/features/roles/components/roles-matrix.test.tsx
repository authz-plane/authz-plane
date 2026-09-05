import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent, within } from "@/test/render";
import { acmeRoles } from "../fixtures";
import { RolesMatrix } from "./roles-matrix";

describe("RolesMatrix", () => {
  it("renders the five permission columns and a dot per cell with aria-labels", () => {
    render(<RolesMatrix roles={acmeRoles()} selectedKey={null} onSelect={() => {}} />);
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["role", "tenant.read", "tenant.write", "relations.write", "audit.read", "idp.manage"]);

    const admin = screen.getByRole("row", { name: /tenant_admin/ });
    expect(within(admin).getAllByLabelText("granted")).toHaveLength(5);
    expect(within(admin).queryAllByLabelText("not granted")).toHaveLength(0);
    expect(within(admin).getAllByLabelText("granted")[0]).toHaveTextContent("●");

    const viewer = screen.getByRole("row", { name: /tenant_viewer/ });
    expect(within(viewer).getAllByLabelText("granted")).toHaveLength(2);
    expect(within(viewer).getAllByLabelText("not granted")).toHaveLength(3);
    expect(within(viewer).getAllByLabelText("not granted")[0]).toHaveTextContent("○");
  });

  it("tints the staged row and captions it; dims the unused role", () => {
    render(<RolesMatrix roles={acmeRoles()} selectedKey={null} onSelect={() => {}} />);
    const staged = screen.getByRole("row", { name: /tenant_auditor/ });
    expect(staged.className).toContain("bg-ready-tint");
    expect(within(staged).getByText("staged in gen 10 · not applied")).toBeInTheDocument();
    expect(within(staged).getByText("tenant_auditor").className).toContain("text-ready");

    const legacy = screen.getByRole("row", { name: /tenant_legacy_ops/ });
    expect(within(legacy).getByText("tenant_legacy_ops").className).toContain("text-fg-meta");
    expect(within(legacy).getByText("0 users · unused 41d")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /tenant_admin/ })).getByText("14 users · from spec")).toBeInTheDocument();
  });

  it("selects a row on click and on Enter", async () => {
    const onSelect = vi.fn();
    render(<RolesMatrix roles={acmeRoles()} selectedKey="tenant_auditor" onSelect={onSelect} />);
    expect(screen.getByRole("row", { name: /tenant_auditor/ })).toHaveAttribute("aria-selected", "true");
    await userEvent.click(screen.getByRole("row", { name: /tenant_editor/ }));
    expect(onSelect).toHaveBeenCalledWith("tenant_editor");
    screen.getByRole("row", { name: /tenant_viewer/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("tenant_viewer");
  });
});
