import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpecEditorView } from "@/features/spec/components/spec-editor-view";
import { specKeys } from "@/features/spec/keys";
import { getSpec } from "@/features/spec/server";

export async function generateMetadata({ params }: PageProps<"/tenants/[slug]/spec">): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} · Spec` };
}

/** Screen 05. The server seeds the current document; the client owns the draft, validation and save. */
export default async function SpecEditorPage({ params }: PageProps<"/tenants/[slug]/spec">) {
  const { slug } = await params;
  const spec = await getSpec(slug);
  if (!spec) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(specKeys.current(slug), spec);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SpecEditorView slug={slug} />
    </HydrationBoundary>
  );
}
