import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { PlaygroundView } from "@/features/playground/components/playground-view";
import { DEFAULT_QUERY } from "@/features/playground/fixtures";
import { playgroundKeys, type SubmittedQuery } from "@/features/playground/keys";
import { explainForTenant, listPlaygroundTenants } from "@/features/playground/server";

export const metadata: Metadata = { title: "Permission playground" };

/**
 * Screen 15. The server pre-runs the frame's query (user:raj viewer
 * document:budget-2026 in acme-air, strong consistency) so the first paint
 * already shows the resolution tree; the client owns every query after that.
 */
export default async function PlaygroundPage() {
  const initialQuery: SubmittedQuery = {
    slug: DEFAULT_QUERY.slug,
    user: DEFAULT_QUERY.user,
    relation: DEFAULT_QUERY.relation,
    object: DEFAULT_QUERY.object,
    consistency: "strong",
    includeProvenance: true,
  };
  const [tenants, initial] = await Promise.all([
    listPlaygroundTenants(),
    explainForTenant(
      initialQuery.slug,
      { user: initialQuery.user, relation: initialQuery.relation, object: initialQuery.object, includeProvenance: true },
      initialQuery.consistency,
    ),
  ]);

  const queryClient = new QueryClient();
  if (initial) queryClient.setQueryData(playgroundKeys.explain(initialQuery), initial);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlaygroundView tenants={tenants} initialQuery={initialQuery} />
    </HydrationBoundary>
  );
}
