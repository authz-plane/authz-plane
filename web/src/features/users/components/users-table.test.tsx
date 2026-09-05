import { describe, expect, it } from "vitest";
import { render, screen, within } from "@/test/render";
import { acmeUsers } from "../fixtures";
import { UsersTable } from "./users-table";

const ITEMS = acmeUsers("2026-09-04T10:15:00Z").slice(0, 8);

describe("UsersTable", () => {
  it("renders the five columns and a row per user with avatar, name and mono email", () => {
    render(<UsersTable slug="acme-air" items={ITEMS} />);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["user", "subject", "roles", "tuples", "state"]);
    expect(screen.getAllByRole("row")).toHaveLength(9);
    const ana = screen.getByRole("row", { name: "user:ana" });
    expect(within(ana).getByText("AR")).toBeInTheDocument();
    expect(within(ana).getByText("Ana Ruiz")).toBeInTheDocument();
    expect(within(ana).getByText("ana.ruiz@acme-air.test").className).toContain("font-mono");
    expect(within(ana).getByText("tenant_admin")).toBeInTheDocument();
    expect(within(ana).getByRole("link", { name: "6 tuples for user:ana" })).toHaveAttribute("href", "/tenants/acme-air/relations?user=user%3Aana");
    expect(within(ana).getByText("active").className).toContain("text-ready");
  });

  it("marks the staged role with * in the ready tone and explains it to screen readers", () => {
    render(<UsersTable slug="acme-air" items={ITEMS} />);
    const mira = screen.getByRole("row", { name: "user:mira" });
    const role = within(mira).getByTitle("staged in the next generation, not yet applied");
    expect(role).toHaveTextContent("tenant_auditor*");
    expect(role.className).toContain("text-ready");
    expect(within(role).getByText("(staged)").className).toContain("sr-only");
  });

  it("shows a pending delete in the failed tone instead of the count", () => {
    render(<UsersTable slug="acme-air" items={ITEMS} />);
    const dana = screen.getByRole("row", { name: "user:dana" });
    expect(within(dana).getByText("1 pending delete").className).toContain("text-failed");
    expect(within(dana).queryByRole("link")).not.toBeInTheDocument();
  });

  it("captions the unmanaged row 'not in desired state' with a drift role and chip", () => {
    render(<UsersTable slug="acme-air" items={ITEMS} />);
    const ext = screen.getByRole("row", { name: "user:ext-audit" });
    expect(within(ext).getByText("ext-audit@vendor.test").className).toContain("text-fg-secondary");
    expect(within(ext).getByText("not in desired state").className).toContain("text-drift");
    expect(within(ext).getByText("admin (drift)").className).toContain("text-drift");
    expect(within(ext).getByText("unmanaged").className).toContain("text-drift");
    expect(within(ext).getByRole("link", { name: "1 tuples for user:ext-audit" }).className).toContain("text-drift");
    expect(within(ext).getByText("EA")).toBeInTheDocument();
  });
});
