import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RelationsView } from "@/features/relations/components/relations-view";
import { relationsKeys } from "@/features/relations/keys";
import { parseRelationsFilter } from "@/features/relations/schemas";
import { listRelations } from "@/features/relations/server";

export const metadata: Metadata = { title: "Relations" };

/** Screen 14. Filters come from the URL; the server seeds page one of the infinite query. */
export default async function RelationsPage({ params, searchParams }: PageProps<"/tenants/[slug]/relations">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const filter = parseRelationsFilter(query);
  const first = await listRelations(slug, filter, undefined);
  if (!first) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(relationsKeys.list(slug, filter), { pages: [first], pageParams: [undefined] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RelationsView slug={slug} filter={filter} />
    </HydrationBoundary>
  );
}
