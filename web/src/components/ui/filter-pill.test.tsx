import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { FilterPill } from "./filter-pill";

describe("FilterPill", () => {
  it("renders as a link carrying search params when href is given", () => {
    render(
      <FilterPill href="/tenants?phase=Ready" active count={38} countClassName="text-ready">
        Ready
      </FilterPill>,
    );
    const link = screen.getByRole("link", { name: /Ready/ });
    expect(link).toHaveAttribute("href", "/tenants?phase=Ready");
    expect(link).toHaveAttribute("aria-current", "true");
    expect(screen.getByText("38").className).toContain("text-ready");
  });

  it("renders as a pressed button otherwise", async () => {
    const onClick = vi.fn();
    render(
      <FilterPill onClick={onClick} active={false}>
        Has open drift
      </FilterPill>,
    );
    const btn = screen.getByRole("button", { name: "Has open drift" });
    expect(btn).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalled();
  });
});
