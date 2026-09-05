"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { tupleKey, utcDayTime } from "../format";
import type { Tuple, TupleSource } from "../schemas";

export const RELATIONS_COLUMNS = "1.2fr .8fr 1.2fr .9fr .9fr 34px";

function sourceLabel(s: TupleSource): string {
  switch (s.kind) {
    case "spec":
      return `spec gen ${s.generation}`;
    case "api":
      return "api";
    case "drift":
      return "drift · unmanaged";
  }
}

/** `⋯` menu with the single row action: stage the tuple for deletion in the batch. */
function RowMenu({ tuple, staged, onStageDelete }: { tuple: Tuple; staged: boolean; onStageDelete: (t: Tuple) => void }) {
  const [open, setOpen] = useState(false);
  const key = tupleKey(tuple);
  return (
    <div className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-label={`actions for ${key}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="rounded-control px-1.5 font-mono text-fg-meta transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
      >
        ⋯
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 w-[168px] rounded-inner border border-line-modal bg-elevated p-1"
        >
          <button
            type="button"
            role="menuitem"
            disabled={staged}
            onClick={() => {
              onStageDelete(tuple);
              setOpen(false);
            }}
            className="w-full rounded-control px-2.5 py-1.5 text-left text-[12.5px] text-fg-secondary transition-colors duration-[120ms] hover:bg-hover hover:text-fg disabled:opacity-50"
          >
            {staged ? "staged for delete" : "stage delete"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Frame 14 table: grid `1.2fr .8fr 1.2fr .9fr .9fr 34px`. Relation names in
 * link tone (`parent` degraded), drift rows tinted and worded "drift ·
 * unmanaged", timestamps in UTC.
 */
export function RelationsTable({
  items,
  stagedDeleteKeys,
  onStageDelete,
}: {
  items: Tuple[];
  stagedDeleteKeys: ReadonlySet<string>;
  onStageDelete: (t: Tuple) => void;
}) {
  return (
    <Table columns={RELATIONS_COLUMNS} minWidth={880} aria-label="Relation tuples">
      <TableHead className="px-3">
        <TableHeaderCell>user</TableHeaderCell>
        <TableHeaderCell>relation</TableHeaderCell>
        <TableHeaderCell>object</TableHeaderCell>
        <TableHeaderCell>source</TableHeaderCell>
        <TableHeaderCell>written</TableHeaderCell>
        <TableHeaderCell>
          <span className="sr-only">actions</span>
        </TableHeaderCell>
      </TableHead>
      <TableBody>
        {items.map((t) => {
          const drift = t.source.kind === "drift";
          const staged = stagedDeleteKeys.has(tupleKey(t));
          return (
            <TableRow
              key={t.id}
              data-tuple-id={t.id}
              tint={cn(drift && "bg-drift-tint", staged && "opacity-60")}
              className="px-3"
            >
              <TableCell mono className={drift ? "text-drift" : undefined}>
                {t.user}
              </TableCell>
              <TableCell mono className={drift ? "text-drift" : t.relation === "parent" ? "text-degraded" : "text-link"}>
                {t.relation}
              </TableCell>
              <TableCell mono>{t.object}</TableCell>
              <TableCell mono className={drift ? "text-drift" : "text-fg-meta"}>
                {sourceLabel(t.source)}
              </TableCell>
              <TableCell mono className="text-fg-secondary">
                {utcDayTime(t.writtenAt)}
              </TableCell>
              <TableCell className="overflow-visible">
                <RowMenu tuple={t} staged={staged} onStageDelete={onStageDelete} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
