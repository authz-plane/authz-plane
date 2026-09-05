"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Drawer, OverlayHeader } from "@/components/ui/overlay";
import { ProblemNotice } from "@/components/states/system-states";
import { BffError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { utcTimeOfDay, valueLabel } from "../format";
import { useAcknowledge, useHeal } from "../hooks";
import type { DriftFinding } from "../schemas";

/**
 * Screen 11: 640px drawer over the drift table. Route-addressable at
 * /drift/{findingId}; closing hands control back to the caller, which
 * navigates to the table and keeps its search params.
 */
export function FindingDrawer({
  finding,
  open,
  onClose,
  onHealed,
}: {
  finding: DriftFinding | undefined;
  open: boolean;
  onClose: () => void;
  /** called after a successful heal so the caller can clear its selection */
  onHealed?: (runs: Array<{ tenant: string; runId: string }>) => void;
}) {
  const heal = useHeal();
  const ack = useAcknowledge();
  const [error, setError] = useState<{ title: string; detail?: string } | null>(null);
  const busy = heal.isPending || ack.isPending;

  const fail = (e: unknown) =>
    setError(
      e instanceof BffError ? { title: e.title, detail: e.detail } : { title: "Request failed", detail: String(e) },
    );

  return (
    <Drawer open={open} onClose={onClose} title={finding?.title ?? "Drift finding"}>
      {finding ? (
        <>
          <OverlayHeader
            onClose={onClose}
            chip={
              <Chip tone="drift" className="text-[11px]">
                {finding.severity} severity · {finding.status === "open" ? "unresolved" : "acknowledged"}
              </Chip>
            }
            title={<span className="text-[18px]">{finding.title}</span>}
            meta={
              <span className="text-[11.5px]">
                {finding.tenant} · {finding.resource.ref} · detected {utcTimeOfDay(finding.detectedAt)} by resync run{" "}
                {finding.detectedByRun}
              </span>
            }
          />

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-6 py-[22px]">
            <section className="flex flex-col gap-2.5" aria-labelledby="drift-field-diff">
              <Eyebrow id="drift-field-diff">Field diff</Eyebrow>
              <div className="overflow-hidden rounded-inner border border-line font-mono text-[12.5px]">
                <DiffRow label="desired" glyph="+" className="bg-ready-tint text-ready">
                  {finding.resource.path} = {valueLabel(finding.desired)}
                </DiffRow>
                <DiffRow label="actual" glyph="−" className="bg-failed-tint text-failed">
                  {finding.resource.path} = {valueLabel(finding.actual)}
                </DiffRow>
                <DiffRow label="impact" glyph="~" className="border-t border-line text-fg-tertiary">
                  {finding.impact}
                </DiffRow>
              </div>
            </section>

            <section className="flex flex-col gap-2.5" aria-labelledby="drift-evidence">
              <Eyebrow id="drift-evidence">How we found it</Eyebrow>
              <div className="rounded-inner border border-line bg-inset p-3.5 font-mono text-[11.5px] leading-[1.85] text-fg-secondary">
                <div>
                  actualStateHash {finding.evidence.actualStateHash} ≠ lastKnown {finding.evidence.lastKnownHash}
                </div>
                <div>
                  field-level diff produced {finding.evidence.siblingFindings}{" "}
                  {finding.evidence.siblingFindings === 1 ? "finding" : "findings"}
                </div>
                <div>no matching audit event in authz-plane → change did not come from us</div>
                <div className="text-degraded">{finding.evidence.conclusion}</div>
              </div>
            </section>

            <section className="flex flex-col gap-2.5" aria-labelledby="drift-heal-plan">
              <Eyebrow id="drift-heal-plan">Heal plan · 1 change</Eyebrow>
              <div className="flex items-center gap-3 rounded-inner border border-degraded-border bg-degraded-tint-deep px-3.5 py-3 font-mono text-[12.5px]">
                <span aria-hidden className="text-degraded">
                  ~
                </span>
                <span className="sr-only">changed</span>
                <span className="w-24 shrink-0 text-fg-secondary">{finding.healPlan.resource}</span>
                <span className="min-w-0 flex-1 truncate text-fg">{finding.healPlan.description}</span>
                <span className="text-line-disabled">{finding.healPlan.changeKey}</span>
              </div>
            </section>

            {error && <ProblemNotice title={error.title} detail={error.detail} />}

            <div className="mt-auto flex flex-col gap-2.5 pt-2">
              <div className="flex gap-2.5">
                <Button
                  variant="drift"
                  size="md"
                  className="flex-1 rounded-[8px] text-[13px]"
                  disabled={busy || finding.status !== "open"}
                  onClick={() => {
                    setError(null);
                    heal.mutate([finding.id], {
                      onSuccess: (res) => {
                        onHealed?.(res.runs);
                        onClose();
                      },
                      onError: fail,
                    });
                  }}
                >
                  Heal now
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  className="flex-1 rounded-[8px] text-[13px]"
                  disabled={busy || finding.status !== "open"}
                  onClick={() => {
                    setError(null);
                    ack.mutate([finding.id], { onSuccess: onClose, onError: fail });
                  }}
                >
                  Acknowledge as accepted
                </Button>
              </div>
              <p className="font-mono text-[11px] leading-[1.7] text-fg-meta">
                Acknowledging suppresses this exact field path until the desired value changes. Both actions are
                recorded as audit events.
              </p>
            </div>
          </div>
        </>
      ) : (
        <>
          <OverlayHeader onClose={onClose} title="Drift finding" meta="loading…" />
          <div aria-busy className="flex flex-col gap-3 px-6 py-[22px]">
            {[190, 150, 170].map((w) => (
              <div key={w} className="skeleton h-[11px]" style={{ width: w }} />
            ))}
          </div>
        </>
      )}
    </Drawer>
  );
}

/** 64px label column + value, per frame 11's FIELD DIFF block. The glyph keeps colour from carrying state alone. */
function DiffRow({
  label,
  glyph,
  className,
  children,
}: {
  label: string;
  glyph: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 px-3.5 py-[11px]", className)}>
      <span className="w-16 shrink-0 text-fg-meta">{label}</span>
      <span aria-hidden className="w-3 shrink-0">
        {glyph}
      </span>
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}
