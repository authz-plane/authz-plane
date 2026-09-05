"use client";

import { useEffect, useState } from "react";
import { AlertStrip } from "@/components/ui/alert-strip";
import { Button, LinkButton } from "@/components/ui/button";
import type { TenantDetail } from "@/features/tenants/schemas";
import { retryCountdownText } from "./countdown";

/**
 * Ticks once a second after mount, starting from the `now` the server rendered
 * with, so the first client render matches the HTML and the countdown then
 * runs locally (handoff "Live state").
 */
export function useTicker(initialNowIso: string): number {
  const initial = Date.parse(initialNowIso);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const mounted = Date.now();
    const id = setInterval(() => setElapsed(Date.now() - mounted), 1000);
    return () => clearInterval(id);
  }, []);
  return initial + elapsed;
}

/** Frame 04's amber strip: "Not converged · generation 9, observed 8" with the error, attempt counter and a live countdown. */
export function NotConvergedStrip({
  tenant,
  now,
  onRetry,
  retrying,
}: {
  tenant: TenantDetail;
  now: string;
  onRetry: () => void;
  retrying: boolean;
}) {
  const nowMs = useTicker(now);
  const err = tenant.lastError;
  const detail = err
    ? `${err.message} · attempt ${err.attempt} of ${err.maxAttempts} · ${retryCountdownText(err.nextAttemptAt, nowMs)}`
    : `generation ${tenant.generation} is being applied · observed ${tenant.observedGeneration}`;
  const tone = err ? "degraded" : "link";

  return (
    <AlertStrip
      tone={tone}
      title={`Not converged · generation ${tenant.generation}, observed ${tenant.observedGeneration}`}
      detail={<span data-testid="not-converged-detail">{detail}</span>}
      actions={
        <>
          {err && (
            <Button
              variant="outline"
              className="h-[30px] border-degraded-border-strong px-3 text-degraded hover:text-degraded"
              onClick={onRetry}
              disabled={retrying}
            >
              {retrying ? "Retrying…" : "Retry now"}
            </Button>
          )}
          {err && (
            <LinkButton variant="outline" className="h-[30px] px-3" href={`/reconcile-runs/${err.runId}`}>
              View run
            </LinkButton>
          )}
        </>
      }
    />
  );
}
