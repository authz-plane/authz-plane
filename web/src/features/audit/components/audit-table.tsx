"use client";

import type { KeyboardEvent } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { TONES } from "@/lib/phase";
import { ACTION_TONE, shortId, utcTime } from "../format";
import type { AuditEvent } from "../schemas";

/** Frame 17 grid; the platform page prepends a TENANT column. */
export const AUDIT_COLUMNS = ".9fr 1.1fr 1.2fr 1.5fr .8fr";
export const AUDIT_COLUMNS_WITH_TENANT = ".9fr .9fr 1.1fr 1.2fr 1.5fr .8fr";

export function AuditTable({
  items,
  selectedId,
  onSelect,
  showTenant = false,
}: {
  items: AuditEvent[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  showTenant?: boolean;
}) {
  const rowKey = (id: string) => (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  return (
    <Table
      columns={showTenant ? AUDIT_COLUMNS_WITH_TENANT : AUDIT_COLUMNS}
      aria-label="Audit events"
      minWidth={showTenant ? 1040 : 900}
    >
      <TableHead>
        <TableHeaderCell>Time</TableHeaderCell>
        {showTenant && <TableHeaderCell>Tenant</TableHeaderCell>}
        <TableHeaderCell>Actor</TableHeaderCell>
        <TableHeaderCell>Action</TableHeaderCell>
        <TableHeaderCell>Resource</TableHeaderCell>
        <TableHeaderCell>Request</TableHeaderCell>
      </TableHead>
      <TableBody>
        {items.map((e) => {
          const active = e.id === selectedId;
          return (
            <TableRow
              key={e.id}
              interactive
              active={active}
              aria-selected={active}
              tabIndex={0}
              data-event-id={e.id}
              onClick={() => onSelect(e.id)}
              onKeyDown={rowKey(e.id)}
              className="py-[13px] font-mono text-[12px]"
            >
              <TableCell mono className="text-[12px] text-fg-secondary">
                <time dateTime={e.occurredAt}>{utcTime(e.occurredAt)}</time>
              </TableCell>
              {showTenant && (
                <TableCell mono className="text-[12px]">
                  {e.tenant}
                </TableCell>
              )}
              <TableCell mono className={cn("text-[12px]", e.actor.kind === "system" && "text-fg-secondary")}>
                {e.actor.label}
              </TableCell>
              <TableCell mono className={cn("text-[12px]", TONES[ACTION_TONE[e.action]].fg)}>
                {e.action}
              </TableCell>
              <TableCell mono className="text-[12px]">
                {e.resource}
              </TableCell>
              <TableCell mono className="text-[12px] text-fg-meta" title={e.requestId}>
                {shortId(e.requestId)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
