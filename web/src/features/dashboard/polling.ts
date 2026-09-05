import { IN_FLIGHT_PHASES } from "@/lib/phase";
import type { Phase } from "@/features/tenants/schemas";

export const FAST_POLL_MS = 2_000;
export const SLOW_POLL_MS = 10_000;

/**
 * Handoff "Live state": poll every 2s while any tenant is Planning / Applying /
 * Deleting, back off to 10s once everything is settled. Tab blur is handled by
 * TanStack Query's refetchIntervalInBackground=false default.
 */
export function pollIntervalFor(
  byPhase: Partial<Record<Phase, number>> | undefined,
): number {
  if (!byPhase) return SLOW_POLL_MS;
  const inFlight = IN_FLIGHT_PHASES.some((p) => (byPhase[p] ?? 0) > 0);
  return inFlight ? FAST_POLL_MS : SLOW_POLL_MS;
}
