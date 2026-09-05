import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@/test/render";
import { NavItem } from "./nav-item";

describe("NavItem", () => {
  it("marks the current route and its children active", () => {
    vi.mocked(usePathname).mockReturnValue("/tenants/acme-air");
    render(<NavItem href="/tenants">Tenants</NavItem>);
    const link = screen.getByRole("link", { name: "Tenants" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link.className).toContain("bg-selected");
  });

  it("with exact, only the exact path is active", () => {
    vi.mocked(usePathname).mockReturnValue("/tenants/acme-air/spec");
    render(
      <NavItem href="/tenants/acme-air" exact>
        Overview
      </NavItem>,
    );
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("renders a mono count with an optional tone", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(
      <NavItem href="/drift" count={7} countClassName="text-drift">
        Drift
      </NavItem>,
    );
    const count = screen.getByText("7");
    expect(count.className).toContain("font-mono");
    expect(count.className).toContain("text-drift");
  });
});
