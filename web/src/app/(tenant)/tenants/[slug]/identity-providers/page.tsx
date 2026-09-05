import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IdpView } from "@/features/identity-providers/components/idp-view";
import { idpKeys } from "@/features/identity-providers/keys";
import { listIdentityProviders } from "@/features/identity-providers/server";

export const metadata: Metadata = { title: "Identity providers" };

/** Screen 16. `?idp=` selects a connection; the server seeds the list query. */
export default async function IdentityProvidersPage({ params, searchParams }: PageProps<"/tenants/[slug]/identity-providers">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const list = await listIdentityProviders(slug);
  if (!list) notFound();

  const requested = typeof query.idp === "string" ? query.idp : null;
  const selectedId = list.items.some((i) => i.id === requested) ? requested : null;

  const queryClient = new QueryClient();
  queryClient.setQueryData(idpKeys.list(slug), list);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <IdpView slug={slug} selectedId={selectedId} />
    </HydrationBoundary>
  );
}
