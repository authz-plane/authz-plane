import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthorizationModelView } from "@/features/authz-model/components/model-view";
import { authzModelKeys } from "@/features/authz-model/keys";
import { getAuthorizationModel } from "@/features/authz-model/server";

export const metadata: Metadata = { title: "Authorization model" };

/** Screen 12. Server fetches the model once; the client view owns edits, validate and stage. */
export default async function AuthorizationModelPage({ params }: PageProps<"/tenants/[slug]/authorization-model">) {
  const { slug } = await params;
  const model = await getAuthorizationModel(slug);
  if (!model) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(authzModelKeys.model(slug), model);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AuthorizationModelView slug={slug} />
    </HydrationBoundary>
  );
}
