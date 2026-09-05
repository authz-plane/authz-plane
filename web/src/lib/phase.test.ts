import { describe, expect, it } from "vitest";
import { PHASES } from "@/features/tenants/schemas";
import { IN_FLIGHT_PHASES, TONES, toneForPhase } from "./phase";

describe("toneForPhase", () => {
  it("maps every phase to a tone", () => {
    for (const p of PHASES) expect(TONES[toneForPhase(p)]).toBeDefined();
  });

  it("uses the handoff's phase language", () => {
    expect(toneForPhase("Ready")).toBe("ready");
    expect(toneForPhase("Degraded")).toBe("degraded");
    expect(toneForPhase("Failed")).toBe("failed");
    for (const p of ["Pending", "Planning", "Applying", "Deleting"] as const) {
      expect(toneForPhase(p)).toBe("link");
    }
  });
});

describe("TONES", () => {
  it("every tone carries fg, chip, border, tint and fill classes", () => {
    for (const t of Object.values(TONES)) {
      expect(t.fg).toMatch(/^text-/);
      expect(t.chipBg).toMatch(/^bg-/);
      expect(t.border).toMatch(/^border-/);
      expect(t.tint).toMatch(/^bg-/);
      expect(t.fill).toMatch(/^bg-/);
    }
  });
});

describe("IN_FLIGHT_PHASES", () => {
  it("covers exactly the phases that warrant fast polling", () => {
    expect([...IN_FLIGHT_PHASES].sort()).toEqual(["Applying", "Deleting", "Planning"]);
  });
});
