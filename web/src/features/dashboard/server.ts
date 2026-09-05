import "server-only";

import {
  DashboardOverviewSchema,
  ShellSummarySchema,
  type DashboardOverview,
  type ShellSummary,
  type Window,
} from "@/features/dashboard/schemas";
import { dashboardFixture, shellFixture } from "@/features/dashboard/fixtures";

/**
 * Server-side data access for the console shell and the overview screen.
 * Server components call these directly; the /api/dashboard route handler
 * calls the same functions for the client's polling refetches, so both paths
 * return the identical, schema-checked shape.
 *
 * When AUTHZPLANE_API_URL is set this is where the .NET calls go (with the
 * bearer token from the session). Until the API has endpoints, fixtures.
 */

function apiBase(): string | undefined {
  const url = process.env.AUTHZPLANE_API_URL?.trim();
  return url ? url.replace(/\/+$/, "") : undefined;
}

export async function getDashboardOverview(
  window: Window,
): Promise<DashboardOverview> {
  if (apiBase()) {
    // TODO(api): GET /v1/tenants?phase=... + run/drift aggregates; map into the
    // overview shape. No endpoint exists yet, so fall through to fixtures.
  }
  return DashboardOverviewSchema.parse(dashboardFixture(window, new Date()));
}

export async function getShellSummary(): Promise<ShellSummary> {
  if (apiBase()) {
    // TODO(api): GET /readyz for dependency health + counts.
  }
  return ShellSummarySchema.parse(shellFixture());
}
