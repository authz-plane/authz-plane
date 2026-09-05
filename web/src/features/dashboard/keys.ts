import type { Window } from "./schemas";

/** Query keys for the overview screen (handoff "State Management"). */
export const dashboardKeys = {
  overview: (window: Window) => ["dashboard", { window }] as const,
};
