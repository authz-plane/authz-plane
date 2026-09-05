import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { DriftView } from "@/features/drift/components/drift-view";
import { driftKeys } from "@/features/drift/keys";
import { driftFilterFromSearch } from "@/features/drift/schemas";
import { listDrift } from "@/features/drift/server";

export const metadata: Metadata = { title: "Drift" };

/**
 * Screen 10. Filters (tenant, severity) come from the URL; the server seeds
 * the list into the query cache and the client view owns selection and the
 * mutations.
 */
export default async function DriftPage({ searchParams }: PageProps<"/drift">) {
  const filter = driftFilterFromSearch(await searchParams);

  const queryClient = new QueryClient();
  await queryClient.fetchQuery({
    queryKey: driftKeys.list(filter),
    queryFn: () => listDrift(filter),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DriftView filter={filter} basePath="/drift" />
    </HydrationBoundary>
  );
}
