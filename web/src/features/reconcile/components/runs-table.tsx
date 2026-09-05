"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/states/system-states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { TONES } from "@/lib/phase";
import { formatDuration, OUTCOME_TONE, shortId } from "../lib";
import type { RunSummary } from "../schemas";
import { ChangeSegments } from "./change-segments";

export const RUNS_COLUMNS = ".8fr 1.1fr .7fr .6fr 1.3fr .7fr .6fr";

/**
 * Frame 08 table. Every cell is mono 12px; the run id is link-toned and the
 * outcome word carries its phase colour. Rows navigate to the run detail.
 */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  const router = useRouter();

  return (
    <Table columns={RUNS_COLUMNS} minWidth={880} aria-label="Reconcile runs">
      <TableHead>
        <TableHeaderCell>Run</TableHeaderCell>
        <TableHeaderCell>Tenant</TableHeaderCell>
        <TableHeaderCell>Trigger</TableHeaderCell>
        <TableHeaderCell>Gen</TableHeaderCell>
        <TableHeaderCell>Changes</TableHeaderCell>
        <TableHeaderCell>Outcome</TableHeaderCell>
        <TableHeaderCell>Duration</TableHeaderCell>
      </TableHead>
      <TableBody>
        {runs.length === 0 ? (
          <EmptyState title="no runs yet">
            Runs appear here as soon as the reconciler claims an outbox message, a resync tick or a manual
            reconcile for a tenant in scope.
          </EmptyState>
        ) : (
          runs.map((run) => {
            const href = `/reconcile-runs/${run.id}`;
            const inFlight = run.finishedAt === null;
            return (
              <TableRow
                key={run.id}
                interactive
                active={inFlight}
                onClick={() => router.push(href)}
                className="font-mono text-[12px]"
              >
                <TableCell>
                  <Link href={href} className="text-link" title={run.id} onClick={(e) => e.stopPropagation()}>
                    {shortId(run.id)}
                  </Link>
                </TableCell>
                <TableCell className="text-fg">{run.tenantSlug}</TableCell>
                <TableCell className="text-fg-secondary">{run.trigger}</TableCell>
                <TableCell className="text-fg tabular-nums">{run.generation}</TableCell>
                <TableCell className="overflow-visible">
                  <ChangeSegments run={run} />
                </TableCell>
                <TableCell className={cn("transition-colors duration-150", TONES[OUTCOME_TONE[run.outcome]].fg)}>
                  {run.outcome}
                </TableCell>
                <TableCell className="text-fg-secondary tabular-nums">
                  {formatDuration(run.durationMs)}
                  {inFlight && <span className="sr-only"> so far, still running</span>}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
