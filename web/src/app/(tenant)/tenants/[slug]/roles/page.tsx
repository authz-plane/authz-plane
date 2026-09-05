import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RolesView } from "@/features/roles/components/roles-view";
import { rolesKeys } from "@/features/roles/keys";
import { listRoles } from "@/features/roles/server";

export const metadata: Metadata = { title: "Roles & permissions" };

/** Screen 13. `?role=` selects a row; the server seeds the roles query. */
export default async function RolesPage({ params, searchParams }: PageProps<"/tenants/[slug]/roles">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const roles = await listRoles(slug);
  if (!roles) notFound();

  const requested = typeof query.role === "string" ? query.role : null;
  const initialRole = roles.items.some((r) => r.key === requested) ? requested : null;

  const queryClient = new QueryClient();
  queryClient.setQueryData(rolesKeys.list(slug), roles);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RolesView slug={slug} initialRole={initialRole} />
    </HydrationBoundary>
  );
}
