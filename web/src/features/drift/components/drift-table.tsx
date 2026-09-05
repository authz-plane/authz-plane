"use client";

import Link from "next/link";
import type { KeyboardEvent, MouseEvent } from "react";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { ACTUAL_TEXT, relativeAge, rowActionFor, SEVERITY_TONE, valueLabel } from "../format";
import type { DriftFinding } from "../schemas";

/** Frame 10 grid: checkbox, TENANT, RESOURCE, DESIRED, ACTUAL, SEVERITY, DETECTED, action. */
export const DRIFT_COLUMNS = "28px 1fr 1.1fr 1.4fr 1.4fr .7fr .8fr 92px";

export function DriftTable({
  items,
  generatedAt,
  selected,
  onToggle,
  drawerHref,
  onOpen,
  onAcknowledge,
}: {
  items: DriftFinding[];
  /** payload timestamp the relative ages are measured against */
  generatedAt: string;
  selected: ReadonlySet<string>;
  onToggle: (id: string, next: boolean) => void;
  /** route of the detail drawer for a finding (route-addressable, keeps search params) */
  drawerHref: (id: string) => string;
  onOpen: (id: string) => void;
  onAcknowledge: (id: string) => void;
}) {
  const rowClick = (id: string) => (e: MouseEvent<HTMLDivElement>) => {
    // Clicks on the checkbox, the action link/button, or any nested control select/act, not open.
    if ((e.target as HTMLElement).closest("input, a, button, label")) return;
    onOpen(id);
  };
  const rowKey = (id: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter") onOpen(id);
    if (e.key === " ") {
      e.preventDefault();
      onToggle(id, !selected.has(id));
    }
  };

  return (
    <Table columns={DRIFT_COLUMNS} aria-label="Open drift findings" minWidth={980}>
      <TableHead>
        <TableHeaderCell>
          <span className="sr-only">Select</span>
        </TableHeaderCell>
        <TableHeaderCell>Tenant</TableHeaderCell>
        <TableHeaderCell>Resource</TableHeaderCell>
        <TableHeaderCell>Desired</TableHeaderCell>
        <TableHeaderCell>Actual</TableHeaderCell>
        <TableHeaderCell>Severity</TableHeaderCell>
        <TableHeaderCell>Detected</TableHeaderCell>
        <TableHeaderCell>
          <span className="sr-only">Action</span>
        </TableHeaderCell>
      </TableHead>
      <TableBody>
        {items.map((f) => {
          const isSelected = selected.has(f.id);
          const action = rowActionFor(f);
          return (
            <TableRow
              key={f.id}
              interactive
              tint={isSelected ? "bg-drift-tint" : undefined}
              aria-selected={isSelected}
              tabIndex={0}
              data-finding-id={f.id}
              onClick={rowClick(f.id)}
              onKeyDown={rowKey(f.id)}
              className="py-3.5 text-[12.5px]"
            >
              <TableCell className="flex items-center overflow-visible">
                <input
                  type="checkbox"
                  aria-label={`Select finding ${f.id}`}
                  checked={isSelected}
                  onChange={(e) => onToggle(f.id, e.target.checked)}
                  className={cn(
                    "size-[14px] shrink-0 cursor-pointer appearance-none rounded-[4px] border border-line-disabled bg-transparent transition-colors duration-[120ms]",
                    "checked:border-drift checked:bg-drift hover:border-fg-meta",
                  )}
                />
              </TableCell>
              <TableCell mono>{f.tenant}</TableCell>
              <TableCell className="flex flex-col gap-0.5 font-mono">
                <span className="truncate text-[12px] text-fg">{f.resource.kind}</span>
                <span className="truncate text-[11px] text-fg-meta">{f.resource.path}</span>
              </TableCell>
              <TableCell
                mono
                className={cn("text-[11.5px]", f.desired === null ? "text-fg-meta" : "text-ready")}
              >
                {valueLabel(f.desired)}
              </TableCell>
              <TableCell
                mono
                className={cn("text-[11.5px]", f.actual === null ? "text-fg-meta" : ACTUAL_TEXT[f.severity])}
              >
                {valueLabel(f.actual)}
              </TableCell>
              <TableCell className="overflow-visible">
                <Chip tone={SEVERITY_TONE[f.severity]} className="text-[11px]">
                  {f.severity}
                </Chip>
              </TableCell>
              <TableCell mono className="text-[11.5px] text-fg-secondary">
                <time dateTime={f.detectedAt}>{relativeAge(f.detectedAt, generatedAt)}</time>
              </TableCell>
              <TableCell mono className="justify-self-end text-[11.5px]">
                {action === "heal" && (
                  <Link
                    href={drawerHref(f.id)}
                    className="text-drift transition-colors duration-[120ms] hover:text-drift hover:brightness-110"
                    aria-label={`Heal finding ${f.id}`}
                  >
                    Heal →
                  </Link>
                )}
                {action === "ack" && (
                  <button
                    type="button"
                    onClick={() => onAcknowledge(f.id)}
                    className="text-fg-meta transition-colors duration-[120ms] hover:text-fg"
                    aria-label={`Acknowledge finding ${f.id}`}
                  >
                    Ack
                  </button>
                )}
                {action === "view-reconcile" && f.reconcileRunId && (
                  <Link
                    href={`/reconcile-runs/${encodeURIComponent(f.reconcileRunId)}`}
                    className="text-link"
                    aria-label={`View reconcile run for finding ${f.id}`}
                  >
                    view reconcile
                  </Link>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
