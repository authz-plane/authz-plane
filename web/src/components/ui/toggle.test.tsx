import { describe, expect, it, vi } from "vitest";
import { render, screen, userEvent } from "@/test/render";
import { Toggle } from "./toggle";

describe("Toggle", () => {
  it("is an accessible switch that reports its state", () => {
    render(<Toggle checked label="Consistency: strong" />);
    const sw = screen.getByRole("switch", { name: "Consistency: strong" });
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(sw.className).toContain("bg-primary");
  });

  it("calls onChange with the flipped value", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Batch mode" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("ignores clicks while disabled", async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="x" disabled />);
    await userEvent.click(screen.getByRole("switch")).catch(() => undefined);
    expect(onChange).not.toHaveBeenCalled();
  });
});
