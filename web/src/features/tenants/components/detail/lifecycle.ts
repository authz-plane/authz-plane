import type { Phase } from "@/features/tenants/schemas";

/**
 * Lifecycle chip chain for screen 04: Pending → Planning → Applying → Ready,
 * with Degraded spliced in before a dashed ⇢ Ready when the tenant is
 * retrying, Failed as a terminal end, and Ready → Deleting for teardown.
 * Pure so the "current" marker is unit-testable.
 */
export interface LifecycleStep {
  phase: Phase;
  current: boolean;
  /** arrow drawn after this step; null on the last one. "⇢" marks a transition that still has to happen. */
  arrow: "→" | "⇢" | null;
}

export function lifecycleChain(phase: Phase): LifecycleStep[] {
  const order: Phase[] =
    phase === "Degraded"
      ? ["Pending", "Planning", "Applying", "Degraded", "Ready"]
      : phase === "Failed"
        ? ["Pending", "Planning", "Applying", "Failed"]
        : phase === "Deleting"
          ? ["Ready", "Deleting"]
          : ["Pending", "Planning", "Applying", "Ready"];
  const at = order.indexOf(phase);
  return order.map((p, i) => ({
    phase: p,
    current: i === at,
    arrow: i === order.length - 1 ? null : i >= at ? "⇢" : "→",
  }));
}
