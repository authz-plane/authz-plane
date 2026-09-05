"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { Button, LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TableFooter } from "@/components/ui/table";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { relativeAge } from "@/features/tenants/format";
import { bffGet, bffMutate, BffError } from "@/lib/api/client";
import { groupThousands } from "@/lib/format";
import { usersKeys } from "../keys";
import { RefreshResultSchema, UsersPageSchema, type RefreshResult, type UsersFilter, type UsersPage } from "../schemas";
import { InviteDrawer } from "./invite-drawer";
import { UserSearch } from "./user-search";
import { UsersTable } from "./users-table";

function listUrl(slug: string, filter: UsersFilter, cursor: string | undefined): string {
  const params = new URLSearchParams();
  if (filter.q) params.set("q", filter.q);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return `/api/tenants/${encodeURIComponent(slug)}/users${qs ? `?${qs}` : ""}`;
}

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Refresh failed", detail: error instanceof Error ? error.message : undefined };
}

/**
 * Screen 18. The mirror is read-only: the two actions ask the IdP (refresh,
 * invite) and nothing edits a row. Search lives in ?q=; pages arrive through
 * the cursor via useInfiniteQuery.
 */
export function UsersView({ slug, filter }: { slug: string; filter: UsersFilter }) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: usersKeys.list(slug, filter),
    queryFn: ({ pageParam }) => bffGet(listUrl(slug, filter, pageParam), UsersPageSchema),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: UsersPage) => last.nextCursor ?? undefined,
  });
  const [inviteOpen, setInviteOpen] = useState(false);
  const closeInvite = useCallback(() => setInviteOpen(false), []);
  const [refreshed, setRefreshed] = useState<RefreshResult | null>(null);

  const refresh = useMutation({
    mutationFn: () => bffMutate(`/api/tenants/${encodeURIComponent(slug)}/users/refresh`, { method: "POST" }, RefreshResultSchema),
    onSuccess: async (result) => {
      setRefreshed(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersKeys.all(slug) }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
        queryClient.invalidateQueries({ queryKey: ["tenant", slug] }),
      ]);
    },
  });

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const first = pages[0];

  if (!first) {
    return (
      <>
        <TenantTopbar slug={slug} title="Users" chip={<Chip tone="neutral">read-only mirror</Chip>} />
        <div className="p-6">
          <ProblemNotice title="Users unavailable" detail={query.error instanceof Error ? query.error.message : "no data"} />
        </div>
      </>
    );
  }

  const remaining = Math.max(0, first.total - items.length);
  const runHref = `/reconcile-runs/${encodeURIComponent(first.lastRefreshRunId)}`;

  return (
    <>
      <TenantTopbar
        slug={slug}
        title="Users"
        chip={<Chip tone="neutral">read-only mirror</Chip>}
        actions={
          <>
            <Button variant="outline" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              {refresh.isPending ? "Enqueuing…" : "Refresh from IdP"}
            </Button>
            <Button variant="secondary" onClick={() => setInviteOpen(true)}>
              Invite user
            </Button>
          </>
        }
      />
      <div className="flex shrink-0 items-center gap-3 border-b border-line-row px-6 py-4">
        <UserSearch key={filter.q ?? ""} initial={filter.q ?? ""} />
        {filter.q && (
          <span className="font-mono text-[11px] text-fg-meta">
            {groupThousands(first.total)} match{first.total === 1 ? "" : "es"} for <span className="text-fg-secondary">{filter.q}</span>
          </span>
        )}
        <span className="ml-auto font-mono text-[11.5px] text-fg-meta">
          {groupThousands(first.userCount)} users · last refreshed {relativeAge(first.lastRefreshedAt, first.asOf)} by resync run{" "}
          <Link href={runHref} className="text-link" title={first.lastRefreshRunId}>
            {first.lastRefreshRunId.slice(0, 4)}
          </Link>
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6">
        {refreshed && (
          <p role="status" className="px-3 pt-3 font-mono text-[11px] text-ready">
            ✓ resync enqueued · run{" "}
            <Link href={`/reconcile-runs/${encodeURIComponent(refreshed.runId)}`} className="text-link">
              {refreshed.runId.slice(0, 4)}
            </Link>{" "}
            refreshes the mirror
          </p>
        )}
        {refresh.error && (
          <div className="pt-3">
            <ProblemNotice {...problemOf(refresh.error)} onRetry={() => refresh.reset()} />
          </div>
        )}
        {items.length === 0 ? (
          <EmptyState eyebrow="empty · no users" title={filter.q ? "No users match this search" : "No users in the mirror yet"}>
            {filter.q
              ? "Search matches email, subject and name. Clear the term to see the whole mirror."
              : "The mirror fills when the IdP reports accounts and a resync run copies them here."}
            {filter.q && (
              <div className="pt-3">
                <LinkButton href={`/tenants/${slug}/users`} variant="secondary" size="sm">
                  Clear search
                </LinkButton>
              </div>
            )}
          </EmptyState>
        ) : (
          <UsersTable slug={slug} items={items} />
        )}
        <TableFooter className="px-3 text-[11.5px]">
          <span>
            <span aria-hidden>* </span>staged in generation {first.stagedGeneration}, not yet applied · user records are owned by the IdP, never
            edited here
          </span>
          <span className="flex items-center gap-3">
            {remaining > 0 && <span>{groupThousands(remaining)} more</span>}
            {query.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </span>
        </TableFooter>
        {query.error && (
          <p role="status" className="px-3 pb-3 font-mono text-[11px] text-degraded">
            ⚠ last fetch failed · {query.error.message}
          </p>
        )}
      </div>
      {inviteOpen && <InviteDrawer slug={slug} roles={first.inviteRoles} open onClose={closeInvite} />}
    </>
  );
}
