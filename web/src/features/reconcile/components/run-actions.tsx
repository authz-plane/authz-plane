"use client";

import { Button, LinkButton } from "@/components/ui/button";
import { snapshotFilename } from "../lib";
import type { RunDetail } from "../schemas";

/** Builds and clicks a temporary object URL; no server round-trip, the snapshot came with the detail. */
export function downloadSnapshot(run: Pick<RunDetail, "id" | "snapshot">): void {
  if (typeof URL.createObjectURL !== "function") return;
  const blob = new Blob([JSON.stringify(run.snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = snapshotFilename(run.id);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Header actions from frame 09: Open trace ↗ (external, new tab), Pre-apply
 * snapshot (JSON download), Retry run (primary). Retry is disabled while the
 * run is still in flight; the caller owns the mutation so it can surface the
 * problem+json response in the body.
 */
export function RunActions({
  run,
  onRetry,
  retrying,
}: {
  run: RunDetail;
  onRetry: () => void;
  retrying: boolean;
}) {
  const inFlight = run.finishedAt === null;
  return (
    <>
      <LinkButton
        external
        href={run.traceUrl}
        target="_blank"
        rel="noopener noreferrer"
        variant="outline"
        size="sm"
      >
        Open trace <span aria-hidden>↗</span>
        <span className="sr-only">(opens in a new tab)</span>
      </LinkButton>
      <Button
        variant="outline"
        size="sm"
        onClick={() => downloadSnapshot(run)}
        disabled={!run.facts.snapshotKey}
        title={run.facts.snapshotKey ? snapshotFilename(run.id) : "No snapshot: the run planned no changes"}
      >
        Pre-apply snapshot
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={onRetry}
        disabled={inFlight || retrying}
        title={inFlight ? "Wait for the run to settle before retrying" : undefined}
      >
        {retrying ? "Enqueuing…" : "Retry run"}
      </Button>
    </>
  );
}
