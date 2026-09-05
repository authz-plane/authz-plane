"use client";

import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import { BATCH_PLACEHOLDER } from "@/features/playground/fixtures";
import type { PlaygroundTenant } from "@/features/playground/schemas";

export interface QueryDraft {
  slug: string;
  user: string;
  relation: string;
  object: string;
}

export interface QueryOptions {
  strong: boolean;
  provenance: boolean;
  batch: boolean;
}

export interface RecentQuery extends QueryDraft {
  id: string;
  allowed: boolean;
}

/** Mono eyebrow + control, 7px gap (frame 15 left column). */
function Labelled({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <Eyebrow>
        <label htmlFor={htmlFor}>{label}</label>
      </Eyebrow>
      {children}
    </div>
  );
}

function OptionRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-[12.5px] text-fg-secondary">
      <label htmlFor={id}>{label}</label>
      <Toggle id={id} label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

export function QueryForm({
  tenants,
  draft,
  options,
  batchText,
  batchError,
  recent,
  pending,
  onDraft,
  onOptions,
  onBatchText,
  onSubmit,
  onRecent,
}: {
  tenants: PlaygroundTenant[];
  draft: QueryDraft;
  options: QueryOptions;
  batchText: string;
  batchError: string | null;
  recent: RecentQuery[];
  pending: boolean;
  onDraft: (next: QueryDraft) => void;
  onOptions: (next: QueryOptions) => void;
  onBatchText: (text: string) => void;
  onSubmit: () => void;
  onRecent: (q: RecentQuery) => void;
}) {
  const tenant = tenants.find((t) => t.slug === draft.slug) ?? tenants[0];
  const relations = tenant?.relations ?? [];

  return (
    <form
      className="flex flex-1 flex-col gap-3.5 p-[18px]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Labelled label="Tenant" htmlFor="pg-tenant">
        <Select
          id="pg-tenant"
          mono
          className="h-[38px] rounded-[8px]"
          value={draft.slug}
          onChange={(e) => {
            const next = tenants.find((t) => t.slug === e.target.value);
            const relation = next && !next.relations.includes(draft.relation) ? (next.relations[0] ?? draft.relation) : draft.relation;
            onDraft({ ...draft, slug: e.target.value, relation });
          }}
        >
          {tenants.map((t) => (
            <option key={t.slug} value={t.slug} className="bg-elevated text-fg">
              {t.slug}
            </option>
          ))}
        </Select>
      </Labelled>

      {options.batch ? (
        <Labelled label="Tuples · one per line" htmlFor="pg-batch">
          <Textarea
            id="pg-batch"
            rows={6}
            placeholder={BATCH_PLACEHOLDER}
            value={batchText}
            onChange={(e) => onBatchText(e.target.value)}
            aria-invalid={batchError ? true : undefined}
            className={cn("rounded-[8px]", batchError && "border-failed-border-strong")}
          />
          {batchError && (
            <span role="alert" className="font-mono text-[11px] text-failed">
              {batchError}
            </span>
          )}
        </Labelled>
      ) : (
        <>
          <Labelled label="User" htmlFor="pg-user">
            <Input
              id="pg-user"
              mono
              className="h-[38px] rounded-[8px]"
              placeholder="user:raj"
              value={draft.user}
              onChange={(e) => onDraft({ ...draft, user: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </Labelled>
          <Labelled label="Relation" htmlFor="pg-relation">
            <Select
              id="pg-relation"
              mono
              className="h-[38px] rounded-[8px]"
              value={draft.relation}
              onChange={(e) => onDraft({ ...draft, relation: e.target.value })}
            >
              {relations.map((r) => (
                <option key={r} value={r} className="bg-elevated text-fg">
                  {r}
                </option>
              ))}
            </Select>
          </Labelled>
          <Labelled label="Object" htmlFor="pg-object">
            <Input
              id="pg-object"
              mono
              className="h-[38px] rounded-[8px]"
              placeholder="document:budget-2026"
              value={draft.object}
              onChange={(e) => onDraft({ ...draft, object: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </Labelled>
        </>
      )}

      <fieldset className="flex flex-col gap-[9px] rounded-inner border border-line bg-inset p-3.5">
        <legend className="sr-only">Options</legend>
        <Eyebrow aria-hidden>Options</Eyebrow>
        <OptionRow id="pg-strong" label="Consistency: strong" checked={options.strong} onChange={(v) => onOptions({ ...options, strong: v })} />
        <OptionRow
          id="pg-provenance"
          label="Include tuple provenance"
          checked={options.provenance}
          onChange={(v) => onOptions({ ...options, provenance: v })}
        />
        <OptionRow id="pg-batch-mode" label="Batch mode" checked={options.batch} onChange={(v) => onOptions({ ...options, batch: v })} />
      </fieldset>

      <Button type="submit" variant="primary" size="md" className="h-[42px] rounded-[8px]" disabled={pending}>
        {options.batch ? "Check batch" : "Check & explain"}
      </Button>

      <div className="mt-auto flex flex-col gap-2">
        <Eyebrow>Recent</Eyebrow>
        {recent.length === 0 ? (
          <span className="font-mono text-[11.5px] leading-[2] text-fg-meta">nothing asked yet this session</span>
        ) : (
          <ul className="flex flex-col font-mono text-[11.5px] leading-[2] text-fg-tertiary">
            {recent.map((q) => (
              <li key={q.id}>
                <button
                  type="button"
                  onClick={() => onRecent(q)}
                  className="flex w-full items-baseline gap-1.5 truncate text-left transition-colors duration-[120ms] hover:text-fg"
                  title={`re-run in ${q.slug}`}
                >
                  <span className="truncate">
                    {q.user} {q.relation} {q.object}
                  </span>
                  <span className={q.allowed ? "text-ready" : "text-failed"}>{q.allowed ? "allowed" : "denied"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </form>
  );
}
