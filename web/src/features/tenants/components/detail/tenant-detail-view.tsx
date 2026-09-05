"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PageBody, PageHeader } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { ProblemNotice } from "@/components/states/system-states";
import { BffError } from "@/lib/api/client";
import { groupThousands } from "@/lib/format";
import { toneForPhase } from "@/lib/phase";
import type { RunSummary } from "@/features/reconcile/schemas";
import { shortId } from "@/features/reconcile/lib";
import { PlanPreviewModal } from "@/features/spec/components/plan-preview-modal";
import { useReconcileNow } from "@/features/spec/hooks";
import { shortHash, type ReconcileAccepted } from "@/features/spec/schemas";
import { DesiredSummary } from "./desired-summary";
import { DetailStat } from "./detail-stat";
import { FailedTenantNotice } from "./failed-tenant-notice";
import { useTenantDetailQuery } from "./hooks";
import { LifecycleChain } from "./lifecycle-chain";
import { NotConvergedStrip } from "./not-converged-strip";
import { RecentRuns } from "./recent-runs";

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

/**
 * Screen 04. The server seeded ['tenant', slug] and the recent runs; this
 * polls the tenant, owns "Reconcile now" and hosts the plan modal (?plan=1).
 */
export function TenantDetailView({ slug, runs, now }: { slug: string; runs: RunSummary[]; now: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const planOpen = searchParams.get("plan") === "1";

  const { data: tenant, error, refetch } = useTenantDetailQuery(slug);
  const [accepted, setAccepted] = useState<ReconcileAccepted | null>(null);
  const reconcile = useReconcileNow(slug, setAccepted);

  if (!tenant) {
    return (
      <>
        <PageHeader title={slug} />
        <PageBody>
          <ProblemNotice title="Tenant unavailable" detail={error instanceof Error ? error.message : "no data"} onRetry={() => void refetch()} />
        </PageBody>
      </>
    );
  }

  const notConverged = tenant.generation !== tenant.observedGeneration;
  const isFailed = tenant.phase === "Failed";
  const created = tenant.createdAt.slice(0, 10);

  return (
    <>
      <PageHeader
        title={tenant.displayName}
        chip={
          <Chip tone={toneForPhase(tenant.phase)} className="px-2 py-[3px] text-[11px]">
            {tenant.phase}
          </Chip>
        }
        meta={`tenant:${tenant.id} · org ${tenant.orgId ?? "pending"} · created ${created}`}
        actions={
          <>
            <LinkButton variant="outline" href={`${pathname}?plan=1`} scroll={false}>
              Dry-run plan
            </LinkButton>
            <LinkButton variant="outline" href={`/tenants/${slug}/spec`}>
              Edit spec
            </LinkButton>
            <Button variant="primary" onClick={() => reconcile.mutate()} disabled={reconcile.isPending}>
              {reconcile.isPending ? "Enqueuing…" : "Reconcile now"}
            </Button>
            <Button variant="outline" className="w-8 px-0 font-mono text-fg-meta" aria-label="More actions">
              ⋯
            </Button>
          </>
        }
      />

      <PageBody className="gap-4 py-5">
        {(accepted || reconcile.error) && (
          <div>
            {accepted && (
              <p role="status" className="font-mono text-[11.5px] text-ready">
                ✓ reconcile enqueued · run{" "}
                <Link href={`/reconcile-runs/${accepted.runId}`} className="text-link">
                  {shortId(accepted.runId)}
                </Link>{" "}
                → the tenant re-enters Applying on the next poll
              </p>
            )}
            {reconcile.error && <ProblemNotice {...problemOf(reconcile.error)} />}
          </div>
        )}
        {error && (
          <p role="status" className="font-mono text-[11px] text-degraded">
            ⚠ last refresh failed · showing the previous projection · {error instanceof Error ? error.message : "unknown error"}
          </p>
        )}

        {isFailed ? (
          <FailedTenantNotice tenant={tenant} onReconcileAnyway={() => reconcile.mutate()} reconciling={reconcile.isPending} />
        ) : (
          notConverged && <NotConvergedStrip tenant={tenant} now={now} onRetry={() => reconcile.mutate()} retrying={reconcile.isPending} />
        )}

        <div className="grid grid-cols-4 gap-3">
          <DetailStat label="Generation" value={tenant.generation} meta={`specHash ${shortHash(tenant.specHash)}`} />
          <DetailStat
            label="Observed"
            value={tenant.observedGeneration}
            tone={notConverged ? (isFailed ? "text-failed" : "text-degraded") : "text-fg"}
            meta={notConverged ? `lag ${Math.round(tenant.observedLagSeconds)}s` : "converged"}
          />
          <DetailStat label="Relation tuples" value={groupThousands(tenant.tupleCount)} meta={`model v${tenant.modelVersion}`} />
          <DetailStat
            label="Auto-heal"
            value={tenant.autoHeal ? "on" : "off"}
            tone={tenant.autoHeal ? "text-ready" : "text-fg-tertiary"}
            meta={`resync every ${tenant.resyncIntervalSeconds}s`}
          />
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
          <Card className="flex min-h-0 flex-col gap-3.5 p-4">
            <CardTitle>Lifecycle</CardTitle>
            <LifecycleChain phase={tenant.phase} />
            <div className="h-px bg-line" />
            <CardTitle>Recent runs</CardTitle>
            <RecentRuns runs={runs} now={now} />
            <Link href={`/tenants/${slug}/reconcile-runs`} className="mt-auto font-mono text-[11px] text-link">
              all runs →
            </Link>
          </Card>
          <DesiredSummary tenant={tenant} />
        </div>
      </PageBody>

      <PlanPreviewModal slug={slug} open={planOpen} onClose={() => router.replace(pathname, { scroll: false })} />
    </>
  );
}
