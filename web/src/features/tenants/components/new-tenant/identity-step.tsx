"use client";

import { useId } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/cn";
import type { StartFrom } from "../../schemas";
import type { FormAction, NewTenantForm, SlugStatus } from "./form-state";

export interface TenantOption {
  slug: string;
  displayName: string;
}

const START_FROM: ReadonlyArray<{ value: StartFrom; title: string; hint: string }> = [
  { value: "blank", title: "Blank spec", hint: "roles only, no IdP" },
  { value: "copy", title: "Copy from tenant", hint: "clone model + roles" },
  { value: "yaml", title: "Paste YAML", hint: "validated on paste" },
];

function SlugHint({ status }: { status: SlugStatus }) {
  switch (status.kind) {
    case "empty":
      return null;
    case "checking":
      return <span className="text-fg-meta">checking…</span>;
    case "available":
      return <span className="text-ready">available</span>;
    case "taken":
      return <span className="text-failed">taken</span>;
    case "invalid":
    case "error":
      return <span className="text-failed">{status.reason}</span>;
  }
}

/** Step 1 of frame 19: name, immutable slug with async availability, start-from cards, reconcile policy. */
export function IdentityStep({
  form,
  slugStatus,
  tenantOptions,
  dispatch,
}: {
  form: NewTenantForm;
  slugStatus: SlugStatus;
  tenantOptions: TenantOption[];
  dispatch: (action: FormAction) => void;
}) {
  const id = useId();
  const nameId = `${id}-name`;
  const slugId = `${id}-slug`;
  const slugHintId = `${id}-slug-hint`;
  const copyId = `${id}-copy`;
  const yamlId = `${id}-yaml`;
  const resyncId = `${id}-resync`;
  const slugInvalid = slugStatus.kind === "taken" || slugStatus.kind === "invalid";

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[20px] font-semibold leading-tight text-fg">Identity</h2>
        <p className="max-w-[520px] text-[13.5px] leading-[1.55] text-fg-secondary">
          The slug is immutable — it keys every tuple, index and audit row. Everything else can change through a later
          spec version.
        </p>
      </div>

      <div className="grid max-w-[620px] grid-cols-2 gap-4">
        <div className="flex flex-col gap-[7px]">
          <label htmlFor={nameId} className="text-[12px] text-fg-secondary">
            Display name
          </label>
          <Input
            id={nameId}
            autoFocus
            autoComplete="off"
            value={form.displayName}
            onChange={(e) => dispatch({ type: "displayName", value: e.target.value })}
            placeholder="Vertex Freight"
          />
        </div>

        <div className="flex flex-col gap-[7px]">
          <label htmlFor={slugId} className="text-[12px] text-fg-secondary">
            Slug <span className="text-fg-meta">· immutable</span>
          </label>
          <div className="relative">
            <Input
              id={slugId}
              mono
              autoComplete="off"
              spellCheck={false}
              value={form.slug}
              invalid={slugInvalid}
              aria-describedby={slugHintId}
              onChange={(e) => dispatch({ type: "slug", value: e.target.value })}
              placeholder="vertex-freight"
              className="pr-24 text-[13px]"
            />
            <span
              id={slugHintId}
              role="status"
              className="pointer-events-none absolute right-3 top-1/2 max-w-[45%] -translate-y-1/2 truncate font-mono text-[11px]"
            >
              <SlugHint status={slugStatus} />
            </span>
          </div>
        </div>

        <fieldset className="col-span-2 flex flex-col gap-[7px]">
          <legend className="mb-[7px] text-[12px] text-fg-secondary">Start from</legend>
          <div className="flex gap-2.5">
            {START_FROM.map((option) => {
              const selected = form.startFrom === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex flex-1 cursor-pointer flex-col gap-1 rounded-inner border p-[13px] transition-colors duration-[120ms]",
                    selected ? "border-line-focus bg-input-focus-bg" : "border-line hover:border-line-control",
                  )}
                >
                  <input
                    type="radio"
                    name={`${id}-start-from`}
                    value={option.value}
                    checked={selected}
                    onChange={() => dispatch({ type: "startFrom", value: option.value })}
                    className="sr-only"
                  />
                  <span className={cn("text-[13px] font-medium", selected ? "text-fg" : "text-fg-secondary")}>
                    {option.title}
                  </span>
                  <span className="text-[11.5px] text-fg-meta">{option.hint}</span>
                </label>
              );
            })}
          </div>

          {form.startFrom === "copy" && (
            <div className="mt-2 flex flex-col gap-[7px]">
              <label htmlFor={copyId} className="text-[12px] text-fg-secondary">
                Source tenant
              </label>
              <Select
                id={copyId}
                mono
                value={form.copyFromSlug}
                onChange={(e) => dispatch({ type: "copyFromSlug", value: e.target.value })}
              >
                <option value="">pick a tenant…</option>
                {tenantOptions.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.slug} · {t.displayName}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {form.startFrom === "yaml" && (
            <div className="mt-2 flex flex-col gap-[7px]">
              <label htmlFor={yamlId} className="text-[12px] text-fg-secondary">
                Spec YAML
              </label>
              <Textarea
                id={yamlId}
                value={form.yaml}
                spellCheck={false}
                onChange={(e) => dispatch({ type: "yaml", value: e.target.value })}
                placeholder={"apiVersion: authzplane.dev/v1\nkind: Tenant\n…"}
                className="min-h-[160px]"
              />
            </div>
          )}
        </fieldset>

        <section
          aria-labelledby={`${id}-policy`}
          className="col-span-2 flex flex-col gap-[9px] rounded-card border border-line bg-card p-4"
        >
          <Eyebrow id={`${id}-policy`}>Reconcile policy</Eyebrow>
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[13px] text-fg">Auto-heal drift</span>
              <span className="text-[11.5px] text-fg-meta">reconcile automatically when actual state diverges</span>
            </div>
            <Toggle
              label="Auto-heal drift"
              checked={form.autoHeal}
              onChange={(next) => dispatch({ type: "autoHeal", value: next })}
            />
          </div>
          <div aria-hidden className="h-px bg-selected" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-[3px]">
              <label htmlFor={resyncId} className="text-[13px] text-fg">
                Resync interval
              </label>
              <span className="text-[11.5px] text-fg-meta">jittered per tenant</span>
            </div>
            <span className="flex items-center gap-1 font-mono text-[13px] text-fg">
              <input
                id={resyncId}
                type="number"
                inputMode="numeric"
                min={30}
                max={86_400}
                step={30}
                value={form.resyncIntervalSeconds}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) dispatch({ type: "resyncIntervalSeconds", value: n });
                }}
                className="h-8 w-[76px] rounded-control border border-line-control bg-transparent px-2 text-right font-mono text-[13px] text-fg outline-none transition-colors duration-150 hover:border-line-disabled focus:border-line-focus focus:bg-input-focus-bg"
              />
              s
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
