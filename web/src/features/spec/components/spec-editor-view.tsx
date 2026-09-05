"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { SplitBody } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TabStrip } from "@/components/ui/tabs";
import { ProblemNotice } from "@/components/states/system-states";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { shortId } from "@/features/reconcile/lib";
import { BffError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { diffLines, unifiedLines } from "../diff";
import { useSaveSpec, useSpecQuery, useValidateSpec } from "../hooks";
import type { SaveSpecResponse, ValidationResponse } from "../schemas";
import { validationCaption } from "../validate";
import { CodeEditor } from "./code-editor";
import { PlanPreviewModal } from "./plan-preview-modal";
import { ValidationPanel } from "./validation-panel";

export const VALIDATE_DEBOUNCE_MS = 400;

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

/** Read-only key/value summary for the "form view" tab. */
function FormView({ body }: { body: string }) {
  const rows = useMemo(() => {
    const out: Array<{ path: string; value: string }> = [];
    const stack: Array<{ indent: number; key: string }> = [];
    for (const line of body.split("\n")) {
      const m = /^(\s*)(?:-\s+)?([A-Za-z_][\w.-]*)\s*:\s*(.*)$/.exec(line);
      if (!m) continue;
      const indent = m[1]!.length;
      while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop();
      const path = [...stack.map((s) => s.key), m[2]!].join(".");
      if (m[3] && m[3] !== "|") out.push({ path, value: m[3] });
      stack.push({ indent, key: m[2]! });
    }
    return out;
  }, [body]);
  return (
    <dl className="flex flex-col gap-2 px-[18px] py-3.5 font-mono text-[12px]" aria-label="form view">
      {rows.map((r, i) => (
        <div key={`${r.path}-${i}`} className="flex gap-4 border-b border-line-row pb-2">
          <dt className="w-[300px] shrink-0 truncate text-fg-tertiary">{r.path}</dt>
          <dd className="min-w-0 truncate text-fg-code">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Screen 05. The server seeded ['spec', slug, 'current']. Client state per
 * handoff: draft YAML, validation results, ifMatchGeneration, dirty flag.
 * Validate is debounced 400ms after typing stops; Save is disabled while
 * invalid; a 412 renders inline as "spec changed underneath you".
 */
export function SpecEditorView({ slug }: { slug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const planOpen = searchParams.get("plan") === "1";

  const spec = useSpecQuery(slug);
  const validate = useValidateSpec(slug);
  const save = useSaveSpec(slug);

  // null = follow the server body (not dirty); a string = local edits.
  const [localDraft, setLocalDraft] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [caret, setCaret] = useState({ line: 1, col: 1 });
  const [tab, setTab] = useState<"yaml" | "form">("yaml");
  const [saved, setSaved] = useState<SaveSpecResponse | null>(null);

  const serverBody = spec.data?.body ?? "";
  const draft = localDraft ?? serverBody;
  const dirty = localDraft !== null && localDraft !== serverBody;
  const generation = spec.data?.generation ?? 0;

  // Debounced validation: the latest body wins, stale responses are dropped.
  const validateNow = validate.mutate;
  const seq = useRef(0);
  useEffect(() => {
    if (!spec.data) return;
    const mine = ++seq.current;
    const id = setTimeout(
      () => {
        validateNow(draft, { onSuccess: (r) => mine === seq.current && setValidation(r) });
      },
      localDraft === null ? 0 : VALIDATE_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [draft, localDraft, spec.data, validateNow]);

  const preview = useMemo(() => (dirty ? unifiedLines(diffLines(serverBody, draft), 0) : []), [dirty, serverBody, draft]);

  if (!spec.data) {
    return (
      <>
        <TenantTopbar slug={slug} title="Desired state spec" />
        <div className="p-6">
          <ProblemNotice title="Spec unavailable" detail={spec.error instanceof Error ? spec.error.message : "no data"} onRetry={() => void spec.refetch()} />
        </div>
      </>
    );
  }

  const invalid = validation ? !validation.valid : true;
  const lineCount = draft.split("\n").length;
  const caption = validationCaption(validation);
  const captionTone = validation ? (validation.errors > 0 ? "text-failed" : validation.warnings > 0 ? "text-degraded" : "text-ready") : "text-fg-meta";
  const stale = save.error instanceof BffError && save.error.status === 412;
  const saveProblem = save.error ? problemOf(save.error) : null;

  const openPlan = () => router.push(`${pathname}?plan=1`, { scroll: false });

  return (
    <>
      <TenantTopbar
        slug={slug}
        title="Desired state spec"
        chip={
          <Chip tone="link" className="px-2 py-[3px] text-[11px]">
            editing → generation {generation + 1}
          </Chip>
        }
        actions={
          <>
            <span className="mr-1.5 font-mono text-[11px] text-fg-meta">If-Match: {generation}</span>
            <Button variant="outline" onClick={() => validateNow(draft, { onSuccess: setValidation })} disabled={validate.isPending}>
              Validate
            </Button>
            <Button variant="outline" onClick={openPlan}>
              Dry-run plan
            </Button>
            <Button
              variant="primary"
              disabled={invalid || save.isPending}
              title={invalid ? "Fix validation errors before saving" : undefined}
              onClick={() =>
                save.mutate(
                  { body: draft, ifMatch: generation },
                  {
                    onSuccess: (r) => {
                      setSaved(r);
                      setLocalDraft(null);
                    },
                  },
                )
              }
            >
              {save.isPending ? "Saving…" : "Save new version"}
            </Button>
          </>
        }
      />

      <SplitBody
        panelWidth={400}
        panel={
          <ValidationPanel
            validation={validation}
            validating={validate.isPending}
            validationError={validate.error ? problemOf(validate.error) : null}
            generation={generation}
            preview={preview}
            dirty={dirty}
            onDryRun={openPlan}
          />
        }
      >
        <TabStrip
          className="shrink-0 px-3"
          tabs={[
            { label: "tenant.yaml", active: tab === "yaml", onClick: () => setTab("yaml") },
            { label: "form view", active: tab === "form", onClick: () => setTab("form") },
          ]}
          right={
            <span className="flex items-center gap-3">
              <span>YAML</span>
              <span>·</span>
              <span>{lineCount} lines</span>
              <span>·</span>
              <span className={captionTone} data-testid="schema-caption">
                {caption}
              </span>
            </span>
          }
        />

        {(saved || saveProblem) && (
          <div className="border-b border-line-row px-[18px] py-2.5">
            {saved && !saveProblem && (
              <p role="status" className="font-mono text-[11.5px] text-ready">
                ✓ saved generation {saved.generation} · reconcile enqueued · run{" "}
                <Link href={`/reconcile-runs/${saved.runId}`} className="text-link">
                  {shortId(saved.runId)}
                </Link>{" "}
                ·{" "}
                <Link href={`/tenants/${slug}/spec/versions`} className="text-link">
                  history
                </Link>
              </p>
            )}
            {saveProblem && (
              <ProblemNotice
                title={stale ? "Spec changed underneath you" : saveProblem.title}
                detail={stale ? `reload and re-diff · ${saveProblem.detail ?? ""}` : saveProblem.detail}
                onRetry={
                  stale
                    ? () => {
                        save.reset();
                        void spec.refetch();
                      }
                    : undefined
                }
              />
            )}
          </div>
        )}

        {tab === "yaml" ? (
          <CodeEditor id="tenant-yaml" value={draft} onChange={setLocalDraft} issues={validation?.results ?? []} onCaret={setCaret} />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <FormView body={draft} />
          </div>
        )}

        <div className="flex h-[34px] shrink-0 items-center gap-4 border-t border-line px-[18px] font-mono text-[11px] text-fg-meta">
          <span>
            Ln {caret.line}, Col {caret.col}
          </span>
          <span>spaces: 2</span>
          {dirty && <span className="text-degraded">unsaved edits</span>}
          <span className={cn("ml-auto", captionTone)}>{validation ? (validation.errors + validation.warnings === 0 ? "no issues" : caption) : "validating…"}</span>
        </div>
      </SplitBody>

      <PlanPreviewModal slug={slug} open={planOpen} onClose={() => router.replace(pathname, { scroll: false })} draftBody={draft} />
    </>
  );
}
