import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DriftView } from "@/features/drift/components/drift-view";
import { driftKeys } from "@/features/drift/keys";
import { driftFilterFromSearch } from "@/features/drift/schemas";
import { getDriftFinding, listDrift } from "@/features/drift/server";

export async function generateMetadata({ params }: PageProps<"/drift/[findingId]">): Promise<Metadata> {
  const { findingId } = await params;
  return { title: `drift ${findingId}` };
}

/**
 * Screen 11: the same table with the finding's drawer open. Route-addressable
 * so a link to /drift/{id} lands on the drawer; closing navigates back to
 * /drift and keeps the search params.
 */
export default async function DriftFindingPage({ params, searchParams }: PageProps<"/drift/[findingId]">) {
  const [{ findingId }, sp] = await Promise.all([params, searchParams]);
  const filter = driftFilterFromSearch(sp);

  const queryClient = new QueryClient();
  const [finding] = await Promise.all([
    getDriftFinding(findingId),
    queryClient.fetchQuery({ queryKey: driftKeys.list(filter), queryFn: () => listDrift(filter) }),
  ]);
  if (!finding) notFound();
  queryClient.setQueryData(driftKeys.finding(findingId), finding);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DriftView filter={filter} basePath="/drift" openFindingId={findingId} />
    </HydrationBoundary>
  );
}
