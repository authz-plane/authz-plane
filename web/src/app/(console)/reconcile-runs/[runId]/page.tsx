import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunDetailView } from "@/features/reconcile/components/run-detail-view";
import { runKeys } from "@/features/reconcile/keys";
import { shortId } from "@/features/reconcile/lib";
import { getRun } from "@/features/reconcile/server";

export async function generateMetadata({ params }: PageProps<"/reconcile-runs/[runId]">): Promise<Metadata> {
  const { runId } = await params;
  return { title: `run ${shortId(runId)}` };
}

/**
 * Screen 09. The server fetches the run once (advancing a live run by one
 * step) and seeds the cache; the client view owns the header and polls at 1s
 * until finishedAt is set.
 */
export default async function RunDetailPage({ params }: PageProps<"/reconcile-runs/[runId]">) {
  const { runId } = await params;
  const run = await getRun(runId);
  if (!run) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(runKeys.detail(runId), run);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RunDetailView runId={runId} />
    </HydrationBoundary>
  );
}
