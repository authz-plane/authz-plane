"use client";

import Link from "next/link";
import { PageBody, PageHeader, SplitBody } from "@/components/layout/page-header";
import { ProblemNotice } from "@/components/states/system-states";
import { Chip } from "@/components/ui/chip";
import { BffError } from "@/lib/api/client";
import { useRetryRun, useRunQuery } from "../hooks";
import { formatDuration, OUTCOME_TONE, shortId, utcSeconds } from "../lib";
import { OUTCOME_LABELS, type RunDetail } from "../schemas";
import { ChangeList } from "./change-list";
import { PhaseWaterfall } from "./phase-waterfall";
import { RunActions } from "./run-actions";
import { RunFacts } from "./run-facts";
import { WorkerLog } from "./worker-log";

/** `generation 9 · trigger outbox · started 10:14:22Z · 3.4s · traceId 4bf9…a1` */
export function runMeta(run: RunDetail): string {
  const duration = run.finishedAt === null ? `running ${formatDuration(run.durationMs)}` : formatDuration(run.durationMs);
  const retry = run.retryOf ? ` · retry of ${shortId(run.retryOf)}` : "";
  return `generation ${run.generation} · trigger ${run.trigger} · started ${utcSeconds(run.startedAt, true)} · ${duration} · traceId ${shortId(run.traceId)}${retry}`;
}

/**
 * Screen 09. Owns the header too, because the chip, meta line and Retry
 * button all change when a live run settles. Polls /api/reconcile-runs/{id}
 * at 1s until finishedAt is set.
 */
export function RunDetailView({ runId }: { runId: string }) {
  const { data: run, error, refetch } = useRunQuery(runId);
  const retry = useRetryRun({ id: runId, tenantSlug: run?.tenantSlug ?? "" });

  if (!run) {
    return (
      <>
        <PageHeader breadcrumb={<Breadcrumb />} title={`run ${shortId(runId)}`} />
        <PageBody>
          <ProblemNotice
            title="Run unavailable"
            detail={error instanceof BffError ? `${error.status} · ${error.message}` : error?.message ?? "no data"}
            onRetry={() => void refetch()}
          />
        </PageBody>
      </>
    );
  }

  const live = run.finishedAt === null;
  const retryError = retry.error;

  return (
    <>
      <PageHeader
        breadcrumb={<Breadcrumb />}
        title={`run ${shortId(run.id)}`}
        chip={<Chip tone={OUTCOME_TONE[run.outcome]}>{OUTCOME_LABELS[run.outcome]}</Chip>}
        meta={runMeta(run)}
        actions={<RunActions run={run} onRetry={() => retry.mutate()} retrying={retry.isPending} />}
      />
      <SplitBody
        panelWidth={340}
        panel={
          <>
            <RunFacts run={run} />
            <WorkerLog log={run.log} live={live} />
          </>
        }
      >
        <PageBody className="gap-4 py-[22px]">
          {retryError && (
            <ProblemNotice
              title={retryError instanceof BffError ? retryError.title : "Retry failed"}
              detail={retryError instanceof BffError ? retryError.detail : retryError.message}
              onRetry={() => retry.mutate()}
            />
          )}
          <PhaseWaterfall phases={run.phases} />
          <section aria-labelledby="changes-title" className="flex flex-col gap-2">
            <h2 id="changes-title" className="text-[13.5px] font-semibold text-fg">
              Changes
            </h2>
            <ChangeList changes={run.changes} />
          </section>
          {error && (
            <p role="status" className="font-mono text-[11px] text-degraded">
              ⚠ last refresh failed · {error.message}
            </p>
          )}
        </PageBody>
      </SplitBody>
    </>
  );
}

function Breadcrumb() {
  return (
    <span className="font-mono text-[11px] text-fg-tertiary">
      <Link href="/reconcile-runs" className="text-fg-tertiary transition-colors duration-[120ms] hover:text-fg">
        Reconcile runs
      </Link>{" "}
      /
    </span>
  );
}
