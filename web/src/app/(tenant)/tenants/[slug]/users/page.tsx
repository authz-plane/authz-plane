import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UsersView } from "@/features/users/components/users-view";
import { usersKeys } from "@/features/users/keys";
import { parseUsersFilter } from "@/features/users/schemas";
import { listUsers } from "@/features/users/server";

export const metadata: Metadata = { title: "Users" };

/** Screen 18. `?q=` filters server-side; the server seeds page one of the infinite query. */
export default async function UsersPage({ params, searchParams }: PageProps<"/tenants/[slug]/users">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const filter = parseUsersFilter(query);
  const first = await listUsers(slug, filter, undefined);
  if (!first) notFound();

  const queryClient = new QueryClient();
  queryClient.setQueryData(usersKeys.list(slug, filter), { pages: [first], pageParams: [undefined] });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <UsersView slug={slug} filter={filter} />
    </HydrationBoundary>
  );
}
