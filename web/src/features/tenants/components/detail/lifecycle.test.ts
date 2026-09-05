import { describe, expect, it } from "vitest";
import { lifecycleChain } from "./lifecycle";

describe("lifecycleChain", () => {
  it("marks Degraded as current with a dashed transition still to make toward Ready", () => {
    const chain = lifecycleChain("Degraded");
    expect(chain.map((s) => s.phase)).toEqual(["Pending", "Planning", "Applying", "Degraded", "Ready"]);
    expect(chain.findIndex((s) => s.current)).toBe(3);
    expect(chain.filter((s) => s.current)).toHaveLength(1);
    expect(chain.map((s) => s.arrow)).toEqual(["→", "→", "→", "⇢", null]);
  });

  it("uses the plain chain for the happy path and highlights the live phase", () => {
    expect(lifecycleChain("Ready").map((s) => s.phase)).toEqual(["Pending", "Planning", "Applying", "Ready"]);
    expect(lifecycleChain("Ready").find((s) => s.current)!.phase).toBe("Ready");
    expect(lifecycleChain("Applying").map((s) => s.arrow)).toEqual(["→", "→", "⇢", null]);
  });

  it("ends at Failed, which is terminal", () => {
    const chain = lifecycleChain("Failed");
    expect(chain[chain.length - 1]).toMatchObject({ phase: "Failed", current: true, arrow: null });
  });

  it("shows teardown as Ready → Deleting", () => {
    expect(lifecycleChain("Deleting").map((s) => s.phase)).toEqual(["Ready", "Deleting"]);
  });
});
