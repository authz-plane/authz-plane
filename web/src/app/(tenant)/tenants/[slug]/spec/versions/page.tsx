import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecHistoryView } from "@/features/spec/components/spec-history-view";
import { specKeys } from "@/features/spec/keys";
import { listVersions } from "@/features/spec/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]/spec/versions">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Spec history` };
}

function gen(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Screen 06. A/B come from the URL (?a=&b=) so a comparison is shareable; the server seeds the versions list. */
export default async function SpecVersionsPage({ params, searchParams }: PageProps<"/tenants/[slug]/spec/versions">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const versions = await listVersions(slug);
  if (!versions) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(specKeys.versions(slug), versions);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SpecHistoryView slug={slug} a={gen(sp.a)} b={gen(sp.b)} />
    </HydrationBoundary>
  );
}
