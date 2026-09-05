"use client";

import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { SplitBody } from "@/components/layout/page-header";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { Button, LinkButton } from "@/components/ui/button";
import { TableFooter } from "@/components/ui/table";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { bffGet, idempotencyKey as newIdempotencyKey } from "@/lib/api/client";
import { groupThousands } from "@/lib/format";
import { sameTuple, toNdjson, tupleKey } from "../format";
import { PLAYGROUND_KEY, relationsKeys } from "../keys";
import { RelationsPageSchema, type RelationsFilter, type RelationsPage, type Tuple, type TupleInput } from "../schemas";
import { BatchWritePanel, type StagedBatch } from "./batch-write-panel";
import { FilterRow } from "./filter-row";
import { RelationsTable } from "./relations-table";

function listUrl(slug: string, filter: RelationsFilter, cursor: string | undefined): string {
  const params = new URLSearchParams();
  if (filter.user) params.set("user", filter.user);
  if (filter.relation) params.set("relation", filter.relation);
  if (filter.object) params.set("object", filter.object);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return `/api/tenants/${encodeURIComponent(slug)}/relations${qs ? `?${qs}` : ""}`;
}

function downloadNdjson(slug: string, items: Tuple[]) {
  const blob = new Blob([toNdjson(items)], { type: "application/x-ndjson" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}-relations-${items.length}.ndjson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Screen 14. Filters and cursor come from the URL / infinite query; the
 * staged batch is client state here so both the row menus and the panel can
 * add to it. Writes never remove rows optimistically: the write invalidates
 * cached decisions, then the list refetches.
 */
export function RelationsView({ slug, filter }: { slug: string; filter: RelationsFilter }) {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery({
    queryKey: relationsKeys.list(slug, filter),
    queryFn: ({ pageParam }) => bffGet(listUrl(slug, filter, pageParam), RelationsPageSchema),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: RelationsPage) => last.nextCursor ?? undefined,
  });

  const [staged, setStaged] = useState<StagedBatch>({ writes: [], deletes: [] });
  const [batchKey, setBatchKey] = useState<string | null>(null);
  const panelFormRef = useRef<HTMLFormElement | null>(null);

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  const first = pages[0];

  if (!first) {
    return (
      <>
        <TenantTopbar slug={slug} title="Relations" />
        <div className="p-6">
          <ProblemNotice title="Relations unavailable" detail={query.error instanceof Error ? query.error.message : "no data"} />
        </div>
      </>
    );
  }

  const total = first.total;
  const remaining = Math.max(0, total - items.length);
  const hasFilter = Boolean(filter.user || filter.relation || filter.object);
  const stagedDeleteKeys = new Set(staged.deletes.map(tupleKey));

  const ensureKey = () => {
    if (!batchKey) setBatchKey(newIdempotencyKey());
  };
  const stageDelete = (t: Tuple) => {
    ensureKey();
    setStaged((s) => (s.deletes.some((d) => sameTuple(d, t)) ? s : { ...s, deletes: [...s.deletes, { user: t.user, relation: t.relation, object: t.object }] }));
  };
  const addWrite = (t: TupleInput) => {
    ensureKey();
    setStaged((s) => (s.writes.some((w) => sameTuple(w, t)) ? s : { ...s, writes: [...s.writes, t] }));
  };
  const unstage = (kind: "write" | "delete", t: TupleInput) => {
    setStaged((s) =>
      kind === "write"
        ? { ...s, writes: s.writes.filter((w) => !sameTuple(w, t)) }
        : { ...s, deletes: s.deletes.filter((d) => !sameTuple(d, t)) },
    );
  };
  const discard = () => {
    setStaged({ writes: [], deletes: [] });
    setBatchKey(null);
  };

  return (
    <>
      <TenantTopbar
        slug={slug}
        title="Relations"
        meta={`${groupThousands(total)} tuples · model v${first.modelVersion}`}
        actions={
          <>
            <Button variant="outline" onClick={() => downloadNdjson(slug, items)} disabled={items.length === 0}>
              Export NDJSON
            </Button>
            <Button variant="primary" onClick={() => panelFormRef.current?.querySelector("input")?.focus()}>
              Batch write
            </Button>
          </>
        }
      />
      <FilterRow filter={filter} />
      <SplitBody
        panelWidth={380}
        panel={
          <BatchWritePanel
            slug={slug}
            staged={staged}
            idempotencyKey={batchKey}
            cachedDecisions={first.cachedDecisions}
            formRef={panelFormRef}
            onAddWrite={addWrite}
            onUnstage={unstage}
            onDiscard={discard}
            onWritten={async () => {
              discard();
              // No optimistic removal: the write invalidated decisions, now refetch.
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: relationsKeys.all(slug) }),
                queryClient.invalidateQueries({ queryKey: PLAYGROUND_KEY }),
              ]);
            }}
          />
        }
      >
        <div className="flex min-h-0 flex-col px-6">
          {items.length === 0 ? (
            <EmptyState eyebrow="empty · no tuples" title={hasFilter ? "No tuples match these filters" : "No tuples yet"}>
              {hasFilter
                ? "Filters are exact; end a value with * for a prefix, e.g. folder:*."
                : "Tuples arrive when the spec's relations apply or through a batch write."}
              {hasFilter && (
                <div className="pt-3">
                  <LinkButton href={`/tenants/${slug}/relations`} variant="secondary" size="sm">
                    Clear filters
                  </LinkButton>
                </div>
              )}
            </EmptyState>
          ) : (
            <RelationsTable items={items} stagedDeleteKeys={stagedDeleteKeys} onStageDelete={stageDelete} />
          )}
          <TableFooter className="px-3 text-[11.5px]">
            <span>
              {groupThousands(remaining)} more · cursor paginated, tenant_id-leading index
              {!query.hasNextPage && items.length > 0 && <span className="text-fg-footnote"> · fixture materialises {items.length} rows</span>}
            </span>
            {query.hasNextPage && (
              <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                {query.isFetchingNextPage ? "Loading…" : "Load more"}
              </Button>
            )}
          </TableFooter>
          {query.error && (
            <p role="status" className="px-3 pb-3 font-mono text-[11px] text-degraded">
              ⚠ last fetch failed · {query.error.message}
            </p>
          )}
        </div>
      </SplitBody>
    </>
  );
}
