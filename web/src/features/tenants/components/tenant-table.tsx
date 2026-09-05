"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Chip } from "@/components/ui/chip";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { TONES, toneForPhase, type Tone } from "@/lib/phase";
import { tenantListHref } from "../filters";
import { idpLabel, relativeAge } from "../format";
import type { Phase, TenantListFilter, TenantPage, TenantSummary } from "../schemas";

/** Frame 03 grid. Exported so the loading skeleton keeps the same header. */
export const TENANT_COLUMNS = "1.5fr .8fr .9fr .7fr 1fr .8fr 40px";

/** Deleting reads as neutral in the table (frame 03), not as an in-flight blue. */
function rowTone(phase: Phase): Tone {
  return phase === "Deleting" ? "neutral" : toneForPhase(phase);
}

export function TenantTableHeader() {
  return (
    <TableHead>
      <TableHeaderCell>Tenant</TableHeaderCell>
      <TableHeaderCell>Phase</TableHeaderCell>
      <TableHeaderCell>Generation</TableHeaderCell>
      <TableHeaderCell>Drift</TableHeaderCell>
      <TableHeaderCell>Last reconciled</TableHeaderCell>
      <TableHeaderCell>IdP</TableHeaderCell>
      <TableHeaderCell>
        <span className="sr-only">Actions</span>
      </TableHeaderCell>
    </TableHead>
  );
}

/**
 * The whole row navigates to the tenant (overlay link on the name), while the
 * ⋯ menu stays a real button above it. Generation ≠ observed is the primary
 * signal: the number takes the phase colour, "/ obs n" stays meta.
 */
function TenantRowView({ tenant, now }: { tenant: TenantSummary; now: string }) {
  const tone = rowTone(tenant.phase);
  const t = TONES[tone];
  const stuck = tenant.generation !== tenant.observedGeneration;
  return (
    <TableRow interactive className="relative">
      <TableCell className="flex flex-col gap-[3px]">
        <Link
          href={`/tenants/${tenant.slug}`}
          className="truncate text-[13.5px] font-medium text-fg after:absolute after:inset-0 after:content-[''] hover:text-fg"
        >
          {tenant.displayName}
        </Link>
        <span className="truncate font-mono text-[11px] text-fg-meta">{tenant.slug}</span>
      </TableCell>
      <TableCell>
        <Chip tone={tone}>{tenant.phase}</Chip>
      </TableCell>
      <TableCell mono className="text-[12px]">
        <span className={t.fg} title={stuck ? "desired generation ahead of observed" : undefined}>
          {tenant.generation}
        </span>{" "}
        <span className="text-fg-meta">/ obs {tenant.observedGeneration}</span>
      </TableCell>
      <TableCell mono className={cn("text-[12px]", tenant.openDrift > 0 ? "text-drift" : "text-fg-meta")}>
        {tenant.openDrift > 0 ? tenant.openDrift : "—"}
      </TableCell>
      <TableCell mono className="text-[12px] text-fg-secondary">
        {relativeAge(tenant.lastReconciledAt, now)}
      </TableCell>
      <TableCell className={cn("text-[12.5px]", tenant.idp ? "text-fg-secondary" : "text-fg-meta")}>
        {idpLabel(tenant.idp, tenant.phase)}
      </TableCell>
      <TableCell className="relative z-10 flex justify-end overflow-visible">
        <RowMenu tenant={tenant} />
      </TableCell>
    </TableRow>
  );
}

const MENU_ITEMS = [
  { label: "Open overview", path: "" },
  { label: "Edit spec", path: "/spec" },
  { label: "Reconcile runs", path: "/reconcile-runs" },
  { label: "Drift findings", path: "/drift" },
] as const;

/** ⋯ per-row menu: links into the tenant's sections. Closes on Escape or outside click. */
function RowMenu({ tenant }: { tenant: TenantSummary }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Actions for ${tenant.displayName}`}
        onClick={() => setOpen((v) => !v)}
        className="rounded-[5px] px-1.5 py-0.5 font-mono text-[14px] leading-none text-fg-meta transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
      >
        ⋯
      </button>
      {open && (
        <div
          id={id}
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 flex w-[180px] flex-col gap-0.5 rounded-inner border border-line-modal bg-elevated p-1 shadow-[0_18px_40px_rgba(0,0,0,0.5)]"
        >
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.label}
              role="menuitem"
              href={`/tenants/${tenant.slug}${item.path}`}
              onClick={() => setOpen(false)}
              className="rounded-control px-2.5 py-1.5 text-[12.5px] text-fg-secondary transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function TenantTable({ items, now }: { items: TenantSummary[]; now: string }) {
  return (
    <Table columns={TENANT_COLUMNS} minWidth={980} className="px-7">
      <TenantTableHeader />
      <TableBody>
        {items.map((tenant) => (
          <TenantRowView key={tenant.slug} tenant={tenant} now={now} />
        ))}
      </TableBody>
    </Table>
  );
}

const PAGER =
  "inline-flex items-center rounded-pill border px-2.5 py-1 font-mono text-[11.5px] transition-colors duration-[120ms]";

/** 52px footer: "showing n of total" + cursor pager. Disabled ends render as text, not links. */
export function TenantPager({ filter, page }: { filter: TenantListFilter; page: TenantPage }) {
  const hasPrev = Boolean(filter.cursor);
  const hasNext = page.nextCursor !== null;
  return (
    <TableFooter className="shrink-0 border-t border-line px-7 text-[11.5px]">
      <span>
        showing {page.items.length} of {page.total}
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={tenantListHref(filter, { cursor: undefined })} className={cn(PAGER, "border-line-control text-fg-secondary hover:border-line-disabled hover:text-fg")}>
            ← prev
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(PAGER, "border-line text-line-disabled")}>
            ← prev
          </span>
        )}
        {hasNext ? (
          <Link
            href={tenantListHref(filter, { cursor: page.nextCursor ?? undefined })}
            className={cn(PAGER, "border-line-control text-fg-secondary hover:border-line-disabled hover:text-fg")}
          >
            next →
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(PAGER, "border-line text-line-disabled")}>
            next →
          </span>
        )}
      </div>
    </TableFooter>
  );
}
