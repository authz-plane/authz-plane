import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import type { Metadata } from "next";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { WindowSelect } from "@/features/dashboard/components/window-select";
import { Topbar } from "@/components/layout/topbar";
import { LinkButton } from "@/components/ui/button";
import { dashboardKeys } from "@/features/dashboard/keys";
import { DEFAULT_WINDOW, WindowSchema } from "@/features/dashboard/schemas";
import { getDashboardOverview } from "@/features/dashboard/server";

export const metadata: Metadata = { title: "Platform overview" };

/**
 * Screen 02. The server renders the shell and fetches the first payload; the
 * client component takes over polling from the hydrated cache.
 */
export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const params = await searchParams;
  const parsed = WindowSchema.safeParse(
    typeof params.window === "string" ? params.window : DEFAULT_WINDOW,
  );
  const window = parsed.success ? parsed.data : DEFAULT_WINDOW;

  const queryClient = new QueryClient();
  const overview = await queryClient.fetchQuery({
    queryKey: dashboardKeys.overview(window),
    queryFn: () => getDashboardOverview(window),
  });

  return (
    <>
      <Topbar
        title="Platform overview"
        meta={`${overview.tenants.total} tenants · window ${window}`}
        actions={
          <>
            <WindowSelect value={window} />
            <LinkButton href="/tenants/new" variant="secondary" size="sm">
              New tenant
            </LinkButton>
          </>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-7 py-6">
        <HydrationBoundary state={dehydrate(queryClient)}>
          <DashboardView window={window} />
        </HydrationBoundary>
      </div>
    </>
  );
}
