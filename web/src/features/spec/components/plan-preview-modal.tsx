"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Modal, OverlayFooter, OverlayHeader } from "@/components/ui/overlay";
import { Skeleton } from "@/components/ui/skeleton";
import { ProblemNotice } from "@/components/states/system-states";
import { BffError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { utcSeconds } from "@/features/reconcile/lib";
import { usePlanQuery, useReconcileNow } from "../hooks";
import { shortHash, type Plan, type PlanOp } from "../schemas";

const OP: Record<PlanOp, { glyph: string; fg: string; row: string; word: string }> = {
  create: { glyph: "+", fg: "text-ready", row: "border-ready-border bg-ready-tint-deep", word: "create" },
  update: { glyph: "~", fg: "text-degraded", row: "border-degraded-border bg-degraded-tint-deep", word: "update" },
  // failed-row is frame 07's delete-row tint; one shade off failed-tint-deep.
  delete: { glyph: "−", fg: "text-failed", row: "border-failed-border bg-failed-row", word: "delete" },
};

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

function SummaryTile({ n, label, tone }: { n: number; label: string; tone: "ready" | "degraded" | "failed" | "neutral" }) {
  const styles = {
    ready: "border-ready-border bg-ready-tint text-ready",
    degraded: "border-degraded-border bg-degraded-tint text-degraded",
    failed: "border-failed-border bg-failed-tint text-failed",
    neutral: "border-line text-fg-tertiary",
  }[tone];
  return (
    <div className={cn("flex flex-1 flex-col gap-[5px] rounded-inner border px-3.5 py-3", styles)}>
      <span className="font-mono text-[20px] leading-none tabular-nums">{n}</span>
      <span className="text-[12px] text-fg-secondary">{label}</span>
    </div>
  );
}

function downloadPlan(plan: Plan) {
  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plan-${plan.slug}-gen${plan.generation}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Screen 07. Opened by `?plan=1` from the tenant detail (plans the current
 * desired state) or the spec editor (plans the draft). Apply posts the real
 * reconcile and navigates to the run it enqueued.
 */
export function PlanPreviewModal({
  slug,
  open,
  onClose,
  draftBody,
}: {
  slug: string;
  open: boolean;
  onClose: () => void;
  /** editor draft; undefined plans the current generation */
  draftBody?: string;
}) {
  const router = useRouter();
  const plan = usePlanQuery(slug, draftBody, open);
  const apply = useReconcileNow(slug, ({ runId }) => {
    onClose();
    router.push(`/reconcile-runs/${runId}`);
  });

  const total = plan.data ? plan.data.summary.create + plan.data.summary.update + plan.data.summary.delete : 0;
  const title = plan.data ? `Plan for ${slug} · generation ${plan.data.generation}` : `Plan for ${slug}`;

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <OverlayHeader
        title={title}
        meta={
          plan.data
            ? `pure planner · desired gen ${plan.data.generation} vs actual read at ${utcSeconds(plan.data.actualReadAt, true)} · no side effects yet`
            : "pure planner · reading actual state…"
        }
        onClose={onClose}
      />

      {plan.data && (
        <div className="flex gap-2.5 border-b border-line px-6 py-4" aria-label="plan summary">
          <SummaryTile n={plan.data.summary.create} label="to create" tone="ready" />
          <SummaryTile n={plan.data.summary.update} label="to update" tone="degraded" />
          <SummaryTile n={plan.data.summary.delete} label="to delete" tone="failed" />
          <SummaryTile n={plan.data.summary.unchanged} label="unchanged" tone="neutral" />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-6 py-2 font-mono text-[12.5px]">
        <Eyebrow className="py-3 tracking-[0.12em]">Ordered by dependency · org → connection → model → tuples</Eyebrow>

        {plan.isPending && (
          <div className="flex flex-col gap-1.5" aria-busy>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-[8px] border border-line px-3 py-3">
                <Skeleton className="h-[11px] w-[14px]" />
                <Skeleton className="h-[11px] w-[110px]" />
                <Skeleton className="h-[11px] flex-1" />
                <Skeleton className="h-[11px] w-[120px]" />
              </div>
            ))}
          </div>
        )}

        {plan.error && <ProblemNotice {...problemOf(plan.error)} onRetry={() => void plan.refetch()} />}

        {plan.data && (
          <ol className="flex flex-col gap-1.5" aria-label="planned changes">
            {plan.data.changes.map((c) => {
              const s = OP[c.op];
              return (
                <li key={c.changeKey} className={cn("flex items-center gap-3 rounded-[8px] border px-[13px] py-[11px]", s.row)} data-op={c.op}>
                  <span aria-hidden className={cn("w-[14px] shrink-0", s.fg)}>
                    {s.glyph}
                  </span>
                  <span className="sr-only">{s.word}</span>
                  <span className="w-[130px] shrink-0 text-fg-secondary">{c.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-fg">{c.description}</span>
                  <span className="shrink-0 text-line-disabled">changeKey {shortHash(c.changeKey)}</span>
                </li>
              );
            })}
            <li className="flex items-center gap-3 rounded-[8px] border border-dashed border-line px-[13px] py-[11px] text-fg-meta">
              <span aria-hidden className="w-[14px] shrink-0">
                ·
              </span>
              <span className="w-[130px] shrink-0">{plan.data.summary.unchanged} resources</span>
              <span className="flex-1">already match desired state — no calls will be made</span>
            </li>
          </ol>
        )}

        {apply.error && (
          <div className="pt-3">
            <ProblemNotice {...problemOf(apply.error)} />
          </div>
        )}
      </div>

      <OverlayFooter>
        <p className="max-w-[520px] font-mono text-[11.5px] leading-[1.6] text-fg-meta">
          Applying takes the per-tenant advisory lock and writes a pre-apply snapshot to object storage before the first mutation.
        </p>
        <div className="flex shrink-0 items-center gap-2.5">
          <Button variant="outline" className="h-9 px-[15px]" disabled={!plan.data} onClick={() => plan.data && downloadPlan(plan.data)}>
            Download plan JSON
          </Button>
          <Button variant="outline" className="h-9 px-[15px]" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="h-9 px-[18px] text-[13px]"
            disabled={!plan.data || total === 0 || apply.isPending}
            onClick={() => apply.mutate()}
          >
            {apply.isPending ? "Applying…" : `Apply ${total} change${total === 1 ? "" : "s"}`}
          </Button>
        </div>
      </OverlayFooter>
    </Modal>
  );
}
