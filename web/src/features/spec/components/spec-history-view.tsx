"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiffBlock } from "@/components/ui/diff";
import { ProblemNotice } from "@/components/states/system-states";
import { shortId } from "@/features/reconcile/lib";
import { BffError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { changedFieldsLabel, diffLines, sideBySide, summarize, unifiedLines } from "../diff";
import { useRestoreVersion, useVersionsQuery } from "../hooks";
import type { SaveSpecResponse, SpecVersion } from "../schemas";
import { VersionList } from "./version-list";

export interface Selection {
  a: number;
  b: number;
}

/** Defaults: B = current, A = the generation before it. Out-of-range params fall back. */
export function resolveSelection(versions: SpecVersion[], current: number, a?: number, b?: number): Selection {
  const has = (g: number | undefined): g is number => g !== undefined && versions.some((v) => v.generation === g);
  const B = has(b) ? b : current;
  const fallbackA = versions.map((v) => v.generation).find((g) => g < B) ?? B;
  const A = has(a) && a !== B ? a : fallbackA;
  return A <= B ? { a: A, b: B } : { a: B, b: A };
}

/** Click rule: a generation newer than B becomes B; anything else becomes A. */
export function nextSelection(sel: Selection, clicked: number): Selection {
  if (clicked === sel.a || clicked === sel.b) return sel;
  if (clicked > sel.b) return { a: sel.b, b: clicked };
  return { a: clicked, b: sel.b };
}

function paneLabel(v: SpecVersion): string {
  switch (v.status) {
    case "current":
      return `GEN ${v.generation} · CURRENT DESIRED`;
    case "applied":
      return `GEN ${v.generation} · APPLIED, CONVERGED`;
    case "superseded":
      return `GEN ${v.generation} · SUPERSEDED`;
  }
}

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

const PANE_DIFF = "rounded-none border-0 bg-transparent px-1 py-3.5 text-[12.5px] leading-[1.95]";

/**
 * Screen 06. The server seeded ['spec', slug, 'versions']; A/B live in the
 * URL (?a=&b=) so a comparison is shareable. Restore writes the old body as a
 * new generation and never touches history.
 */
export function SpecHistoryView({ slug, a, b }: { slug: string; a?: number; b?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const versions = useVersionsQuery(slug);
  const restore = useRestoreVersion(slug);
  const [unified, setUnified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState<SaveSpecResponse | null>(null);

  const items = useMemo(() => versions.data?.items ?? [], [versions.data]);
  const sel = useMemo(
    () => (versions.data ? resolveSelection(items, versions.data.currentGeneration, a, b) : { a: 0, b: 0 }),
    [versions.data, items, a, b],
  );
  const A = items.find((v) => v.generation === sel.a);
  const B = items.find((v) => v.generation === sel.b);

  const ops = useMemo(() => (A && B ? diffLines(A.body, B.body) : []), [A, B]);
  const summary = useMemo(() => summarize(ops), [ops]);
  const panes = useMemo(() => sideBySide(ops), [ops]);
  const unifiedView = useMemo(() => unifiedLines(ops, Infinity), [ops]);

  const select = (g: number) => {
    const next = nextSelection(sel, g);
    router.replace(`${pathname}?a=${next.a}&b=${next.b}`, { scroll: false });
  };

  if (!versions.data) {
    return (
      <div className="p-6">
        <ProblemNotice title="Versions unavailable" detail={versions.error instanceof Error ? versions.error.message : "no data"} onRetry={() => void versions.refetch()} />
      </div>
    );
  }

  const copy = async () => {
    if (!B) return;
    await navigator.clipboard.writeText(B.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[320px] shrink-0 flex-col border-r border-line bg-panel">
        <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-[18px]">
          <h1 className="text-[14px] font-semibold text-fg">Versions</h1>
          <span className="font-mono text-[11px] text-fg-meta">{versions.data.total} total</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <VersionList versions={items} a={sel.a} b={sel.b} onSelect={select} />
        </div>
        <p className="border-t border-line px-[18px] py-2.5 font-mono text-[10.5px] leading-[1.6] text-fg-meta">
          click a version to compare it as A · secrets shown as refs only ·{" "}
          <Link href={`/tenants/${slug}/spec`} className="text-link">
            open editor
          </Link>
        </p>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line px-6">
          <div className="flex items-center gap-2.5 font-mono text-[12.5px]">
            {/* link-chip-alt is frame 06's A chip; one shade off link-chip. */}
            <span className="rounded-pill bg-link-chip-alt px-[9px] py-1 text-link">A gen {sel.a}</span>
            <span aria-hidden className="text-fg-meta">
              →
            </span>
            <span className="rounded-pill bg-link-chip px-[9px] py-1 text-link">B gen {sel.b}</span>
            <span className="ml-2 text-fg-meta" data-testid="changed-fields">
              {changedFieldsLabel(summary)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={unified ? "secondary" : "outline"} aria-pressed={unified} onClick={() => setUnified((u) => !u)}>
              {unified ? "Side by side" : "Unified"}
            </Button>
            <Button variant="outline" onClick={() => void copy()} disabled={!B}>
              {copied ? "Copied" : "Copy as YAML"}
            </Button>
            <Button
              variant="outline"
              className="border-degraded-border-strong text-degraded hover:text-degraded"
              disabled={!A || A.status === "current" || restore.isPending}
              onClick={() => A && restore.mutate(A.generation, { onSuccess: setRestored })}
            >
              {restore.isPending ? "Restoring…" : `Restore gen ${sel.a} as new version`}
            </Button>
          </div>
        </header>

        {(restored || restore.error) && (
          <div className="border-b border-line-row px-6 py-2.5">
            {restored && !restore.error && (
              <p role="status" className="font-mono text-[11.5px] text-ready">
                ✓ gen {sel.a} restored as generation {restored.generation} · history untouched · reconcile enqueued · run{" "}
                <Link href={`/reconcile-runs/${restored.runId}`} className="text-link">
                  {shortId(restored.runId)}
                </Link>
              </p>
            )}
            {restore.error && <ProblemNotice {...problemOf(restore.error)} />}
          </div>
        )}

        {A && B && (
          <div className="flex min-h-0 flex-1 font-mono">
            {unified ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="border-b border-line-row px-[18px] py-[9px] font-mono text-[11px] tracking-[0.12em] text-fg-tertiary">
                  {paneLabel(A)} → <span className="text-link">{paneLabel(B)}</span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto" aria-label="unified diff">
                  <DiffBlock lines={unifiedView} className={PANE_DIFF} />
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-line" aria-label={`side A · gen ${A.generation}`}>
                  <div className="border-b border-line-row px-[18px] py-[9px] text-[11px] tracking-[0.12em] text-fg-tertiary">{paneLabel(A)}</div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <DiffBlock lines={panes.left} className={PANE_DIFF} />
                  </div>
                </div>
                <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`side B · gen ${B.generation}`}>
                  <div className={cn("border-b border-line-row px-[18px] py-[9px] text-[11px] tracking-[0.12em]", B.status === "current" ? "text-link" : "text-fg-tertiary")}>
                    {paneLabel(B)}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <DiffBlock lines={panes.right} className={PANE_DIFF} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
