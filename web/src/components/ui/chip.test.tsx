import { describe, expect, it } from "vitest";
import { render, screen } from "@/test/render";
import { Chip } from "./chip";

describe("Chip", () => {
  it("renders the phase word, never colour alone", () => {
    render(<Chip tone="degraded">Degraded</Chip>);
    const chip = screen.getByText("Degraded");
    expect(chip).toBeInTheDocument();
    expect(chip.className).toContain("text-degraded");
    expect(chip.className).toContain("bg-degraded-chip");
  });
});
