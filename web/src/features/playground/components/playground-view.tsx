"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { ProblemNotice } from "@/components/states/system-states";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Well, WellLine } from "@/components/ui/well";
import { bffMutate, BffError, idempotencyKey } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { parseBatch } from "../batch";
import { batchCheckPath, curlFor, explainPath, resultMeta } from "../format";
import { playgroundKeys, type SubmittedQuery } from "../keys";
import {
  BatchCheckResponseSchema,
  CheckTupleSchema,
  ExplainResponseSchema,
  type BatchCheckResponse,
  type CheckTuple,
  type ExplainResponse,
  type PlaygroundTenant,
} from "../schemas";
import { BatchResults } from "./batch-results";
import { DecisiveTupleCard } from "./decisive-tuple-card";
import { ExplainStats } from "./explain-stats";
import { QueryForm, type QueryDraft, type QueryOptions, type RecentQuery } from "./query-form";
import { ResolutionTree } from "./resolution-tree";

const RECENT_LIMIT = 6;

function postExplain(q: SubmittedQuery): Promise<ExplainResponse> {
  return bffMutate(
    explainPath(q.slug, q.consistency),
    { method: "POST", body: { user: q.user, relation: q.relation, object: q.object, includeProvenance: q.includeProvenance } },
    ExplainResponseSchema,
  );
}

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Check failed", detail: error instanceof Error ? error.message : undefined };
}

/**
 * Screen 15. Left 380px column asks the question; the right column explains
 * the answer. The last explain result lives in the query cache under a key
 * that includes the submitted tuple, so a relations write elsewhere
 * (`invalidateQueries(["playground"])`) re-runs the visible check. Recent
 * queries are session state only.
 */
export function PlaygroundView({ tenants, initialQuery }: { tenants: PlaygroundTenant[]; initialQuery: SubmittedQuery }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<QueryDraft>({
    slug: initialQuery.slug,
    user: initialQuery.user,
    relation: initialQuery.relation,
    object: initialQuery.object,
  });
  const [options, setOptions] = useState<QueryOptions>({
    strong: initialQuery.consistency === "strong",
    provenance: initialQuery.includeProvenance,
    batch: false,
  });
  const [batchText, setBatchText] = useState("");
  const [batchError, setBatchError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentQuery[]>([]);
  const [submitted, setSubmitted] = useState<SubmittedQuery>(initialQuery);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [batchResult, setBatchResult] = useState<BatchCheckResponse | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);

  const explainQuery = useQuery({
    queryKey: playgroundKeys.explain(submitted),
    queryFn: () => postExplain(submitted),
    staleTime: Infinity,
  });

  const addRecent = (q: SubmittedQuery, allowed: boolean) =>
    setRecent((list) => {
      const rest = list.filter((r) => !(r.slug === q.slug && r.user === q.user && r.relation === q.relation && r.object === q.object));
      return [{ id: idempotencyKey(), slug: q.slug, user: q.user, relation: q.relation, object: q.object, allowed }, ...rest].slice(
        0,
        RECENT_LIMIT,
      );
    });

  const explainMutation = useMutation({
    mutationFn: postExplain,
    onSuccess: (data, q) => {
      queryClient.setQueryData(playgroundKeys.explain(q), data);
      setSubmitted(q);
      setBatchResult(null);
      addRecent(q, data.allowed);
    },
  });

  const batchMutation = useMutation({
    mutationFn: (input: { slug: string; checks: CheckTuple[] }) =>
      bffMutate(
        batchCheckPath(input.slug, options.strong ? "strong" : "eventual"),
        { method: "POST", body: { checks: input.checks } },
        BatchCheckResponseSchema,
      ),
    onSuccess: (data) => setBatchResult(data),
  });

  const submit = () => {
    if (options.batch) {
      const parsed = parseBatch(batchText);
      if (!parsed.ok) {
        setBatchError(parsed.line > 0 ? `line ${parsed.line}: ${parsed.message}` : parsed.message);
        return;
      }
      setBatchError(null);
      batchMutation.mutate({ slug: draft.slug, checks: parsed.checks });
      return;
    }
    const tuple = CheckTupleSchema.safeParse({ user: draft.user, relation: draft.relation, object: draft.object });
    if (!tuple.success) {
      setDraftError(tuple.error.issues[0]?.message ?? "invalid tuple");
      return;
    }
    setDraftError(null);
    explainMutation.mutate({
      slug: draft.slug,
      ...tuple.data,
      consistency: options.strong ? "strong" : "eventual",
      includeProvenance: options.provenance,
    });
  };

  const rerun = (q: RecentQuery) => {
    const next = { slug: q.slug, user: q.user, relation: q.relation, object: q.object };
    setDraft(next);
    setOptions((o) => ({ ...o, batch: false }));
    setDraftError(null);
    explainMutation.mutate({ ...next, consistency: options.strong ? "strong" : "eventual", includeProvenance: options.provenance });
  };

  const copyCurl = async () => {
    const text = curlFor(
      submitted.slug,
      { user: submitted.user, relation: submitted.relation, object: submitted.object, includeProvenance: submitted.includeProvenance },
      submitted.consistency,
    );
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const result = explainQuery.data;
  const pending = explainMutation.isPending || batchMutation.isPending || explainQuery.isFetching;
  const error = explainMutation.error ?? batchMutation.error ?? explainQuery.error;
  const showingBatch = options.batch && batchResult !== null;

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[380px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-[60px] shrink-0 items-center border-b border-line px-[18px]">
          <h1 className="text-[15px] font-semibold text-fg">Ask a question</h1>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          <QueryForm
            tenants={tenants}
            draft={draft}
            options={options}
            batchText={batchText}
            batchError={batchError}
            recent={recent}
            pending={pending}
            onDraft={(next) => {
              setDraft(next);
              setDraftError(null);
            }}
            onOptions={setOptions}
            onBatchText={(t) => {
              setBatchText(t);
              setBatchError(null);
            }}
            onSubmit={submit}
            onRecent={rerun}
          />
          {draftError && (
            <p role="alert" className="px-[18px] pb-4 font-mono text-[11px] text-failed">
              {draftError}
            </p>
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Explain result" aria-busy={pending || undefined}>
        <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-6">
          <div className="flex items-center gap-3">
            {showingBatch && batchResult ? (
              <>
                <Chip tone="neutral" className="rounded-control px-3 py-[5px] text-[13px] font-semibold">
                  BATCH · {batchResult.results.length}
                </Chip>
                <span className="font-mono text-[11.5px] text-fg-meta">
                  {resultMeta({
                    ...batchResult,
                    durationMs: batchResult.results.reduce((sum, r) => sum + r.durationMs, 0),
                    cached: batchResult.consistency !== "strong",
                  })}
                </span>
              </>
            ) : result ? (
              <>
                <Chip
                  tone={result.allowed ? "ready" : "failed"}
                  className={cn("rounded-control px-3 py-[5px] text-[13px] font-semibold", pending && "opacity-70")}
                >
                  {result.allowed ? "ALLOWED" : "DENIED"}
                </Chip>
                <span className="font-mono text-[11.5px] text-fg-meta">{resultMeta(result)}</span>
              </>
            ) : (
              <span className="font-mono text-[11.5px] text-fg-meta">{pending ? "checking…" : "no result yet"}</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="h-[30px] px-3 text-[12px]" onClick={copyCurl} disabled={!result}>
              {copied ? "Copied" : "Copy as curl"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn("h-[30px] px-3 text-[12px]", showRaw && "border-line-disabled text-fg")}
              aria-pressed={showRaw}
              onClick={() => setShowRaw((v) => !v)}
              disabled={!result && !batchResult}
            >
              Raw JSON
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto p-6">
          {error && (
            <ProblemNotice
              {...problemOf(error)}
              onRetry={() => {
                explainMutation.reset();
                batchMutation.reset();
              }}
            />
          )}

          {showRaw && (result || batchResult) ? (
            <div className="flex flex-col gap-3">
              <Eyebrow>Raw JSON</Eyebrow>
              <Well aria-label="Raw JSON" className="overflow-auto text-[11.5px]">
                {JSON.stringify(showingBatch ? batchResult : result, null, 2)
                  .split("\n")
                  .map((line, i) => (
                    <WellLine key={i}>{line}</WellLine>
                  ))}
              </Well>
            </div>
          ) : showingBatch && batchResult ? (
            <BatchResults result={batchResult} />
          ) : result ? (
            <>
              <div className="flex flex-col gap-3">
                <Eyebrow>Resolution tree</Eyebrow>
                <ResolutionTree key={JSON.stringify(playgroundKeys.explain(submitted))} root={result.tree} />
              </div>
              <DecisiveTupleCard slug={submitted.slug} result={result} />
              <ExplainStats result={result} />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
