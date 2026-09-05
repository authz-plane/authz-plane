"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProblemNotice } from "@/components/states/system-states";
import { Well, WellLine } from "@/components/ui/well";
import { BffError, bffMutate } from "@/lib/api/client";
import { keyPreview, tupleKey } from "../format";
import { TupleInputSchema, WriteResultSchema, type TupleInput, type WriteResult } from "../schemas";

export interface StagedBatch {
  writes: TupleInput[];
  deletes: TupleInput[];
}

function StagedLine({ glyph, tone, tuple, onUnstage }: { glyph: string; tone: string; tuple: TupleInput; onUnstage: () => void }) {
  const key = tupleKey(tuple);
  return (
    <WellLine className={`group flex items-center gap-2 ${tone}`}>
      <span aria-label={glyph === "+" ? "write" : "delete"}>{glyph}</span>{" "}
      <span className="min-w-0 flex-1 truncate">{key}</span>
      <button
        type="button"
        aria-label={`unstage ${key}`}
        onClick={onUnstage}
        className="rounded-[4px] px-1 font-mono text-[11px] text-fg-meta opacity-60 transition-opacity hover:opacity-100"
      >
        ✕
      </button>
    </WellLine>
  );
}

/**
 * Right 380px panel of frame 14. Owns the "add a write" form and the write
 * mutation; the staged batch itself belongs to the view so row menus can add
 * to it. The Idempotency-Key is assigned per batch (on first stage) and sent
 * as-is so a retry of the same batch is a no-op server-side.
 */
export function BatchWritePanel({
  slug,
  staged,
  idempotencyKey,
  cachedDecisions,
  formRef,
  onAddWrite,
  onUnstage,
  onDiscard,
  onWritten,
}: {
  slug: string;
  staged: StagedBatch;
  idempotencyKey: string | null;
  cachedDecisions: number;
  /** the add-write form; the view focuses its first input for "Batch write" */
  formRef?: Ref<HTMLFormElement>;
  onAddWrite: (t: TupleInput) => void;
  onUnstage: (kind: "write" | "delete", t: TupleInput) => void;
  onDiscard: () => void;
  onWritten: (r: WriteResult) => void;
}) {
  const [draft, setDraft] = useState<TupleInput>({ user: "", relation: "", object: "" });
  const [draftError, setDraftError] = useState<string | null>(null);
  const [last, setLast] = useState<WriteResult | null>(null);

  const write = useMutation({
    mutationFn: (batch: StagedBatch) =>
      bffMutate(
        `/api/tenants/${encodeURIComponent(slug)}/relations/write`,
        {
          body: batch,
          headers: idempotencyKey ? { "idempotency-key": idempotencyKey } : undefined,
        },
        WriteResultSchema,
      ),
    onSuccess: (result) => {
      setLast(result);
      onWritten(result);
    },
  });

  const w = staged.writes.length;
  const d = staged.deletes.length;
  const empty = w + d === 0;
  const error = write.error;
  const problem =
    error instanceof BffError
      ? { title: `${error.status} · ${error.title}`, detail: error.detail }
      : error
        ? { title: "Write failed", detail: error.message }
        : null;

  const addWrite = () => {
    const parsed = TupleInputSchema.safeParse({
      user: draft.user.trim(),
      relation: draft.relation.trim(),
      object: draft.object.trim(),
    });
    if (!parsed.success) {
      setDraftError("expected user type:id · relation name · object type:id");
      return;
    }
    setDraftError(null);
    onAddWrite(parsed.data);
    setDraft({ user: "", relation: "", object: "" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-[3px] border-b border-line px-[18px] py-4">
        <h2 className="text-[13.5px] font-semibold text-fg">Batch write</h2>
        <span className="font-mono text-[11px] text-fg-meta">POST /relations:write · atomic</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto px-[18px] py-4">
        <Well aria-label="staged payload" className="px-3.5 py-3 text-[12px] leading-[1.9]">
          <WellLine className="text-ready">writes:</WellLine>
          {w === 0 && <WellLine className="text-fg-meta">  (nothing staged)</WellLine>}
          {staged.writes.map((t) => (
            <StagedLine key={tupleKey(t)} glyph="+" tone="text-ready" tuple={t} onUnstage={() => onUnstage("write", t)} />
          ))}
          <WellLine className="text-failed">deletes:</WellLine>
          {d === 0 && <WellLine className="text-fg-meta">  (nothing staged)</WellLine>}
          {staged.deletes.map((t) => (
            <StagedLine key={tupleKey(t)} glyph="−" tone="text-failed" tuple={t} onUnstage={() => onUnstage("delete", t)} />
          ))}
        </Well>

        <form
          ref={formRef}
          aria-label="Add a write"
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addWrite();
          }}
        >
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,.8fr)_minmax(0,1fr)] gap-2">
            <label className="flex min-w-0 flex-col gap-1 font-mono text-[10.5px] text-fg-meta">
              user
              <Input
                mono
                size="sm"
                className="min-w-0 px-2"
                value={draft.user}
                onChange={(e) => setDraft({ ...draft, user: e.target.value })}
                placeholder="user:mira"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 font-mono text-[10.5px] text-fg-meta">
              relation
              <Input
                mono
                size="sm"
                className="min-w-0 px-2"
                value={draft.relation}
                onChange={(e) => setDraft({ ...draft, relation: e.target.value })}
                placeholder="viewer"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1 font-mono text-[10.5px] text-fg-meta">
              object
              <Input
                mono
                size="sm"
                className="min-w-0 px-2"
                value={draft.object}
                onChange={(e) => setDraft({ ...draft, object: e.target.value })}
                placeholder="folder:finance"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <div className="flex items-center justify-between gap-2">
            {draftError ? (
              <span role="alert" className="font-mono text-[11px] text-failed">
                {draftError}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-fg-meta">stage a write · deletes come from the row menu</span>
            )}
            <Button type="submit" variant="outline" size="sm">
              Add write
            </Button>
          </div>
        </form>

        <div className="flex gap-2 rounded-[8px] border border-degraded-border bg-degraded-tint p-3">
          <span aria-hidden className="text-degraded">
            ⚠
          </span>
          <p className="text-[12px] leading-[1.55] text-fg-secondary">
            Reserved namespace <span className="font-mono">platform:*</span> is rejected at validation. Tuples are checked
            against this tenant&apos;s model only.
          </p>
        </div>

        <dl className="flex flex-col gap-2 font-mono text-[11px] leading-[1.7] text-fg-meta">
          <div className="flex gap-2">
            <dt>Idempotency-Key:</dt>
            <dd data-testid="idempotency-preview">{idempotencyKey ? keyPreview(idempotencyKey) : "assigned when the first change is staged"}</dd>
          </div>
          <div>
            <dt className="sr-only">Cache</dt>
            <dd>Invalidates {cachedDecisions} cached decisions by tag before returning</dd>
          </div>
        </dl>

        {problem && <ProblemNotice title={problem.title} detail={problem.detail} />}
        {last && !problem && (
          <p role="status" className="font-mono text-[11px] text-ready">
            ✓ wrote {last.written} · deleted {last.deleted} · invalidated {last.invalidatedDecisions} cached decisions · model v
            {last.modelVersion}
          </p>
        )}

        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="h-[38px] min-w-0 flex-1 rounded-[8px] px-3" disabled={empty} onClick={onDiscard}>
            Discard
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="h-[38px] min-w-0 flex-1 rounded-[8px] px-3"
            disabled={empty || write.isPending}
            onClick={() => write.mutate(staged)}
          >
            {write.isPending ? "Writing…" : `Write ${w} · delete ${d}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
