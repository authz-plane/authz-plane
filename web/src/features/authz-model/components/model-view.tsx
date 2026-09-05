"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/input";
import { ProblemNotice } from "@/components/states/system-states";
import { BffError, bffGet, bffMutate } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { groupThousands } from "@/lib/format";
import { parseModel, summarize } from "../dsl";
import { authzModelKeys } from "../keys";
import {
  AuthorizationModelSchema,
  StageResultSchema,
  ValidationResultSchema,
  type AuthorizationModel,
  type StageResult,
  type ValidationResult,
} from "../schemas";
import { DslView } from "./dsl-view";
import { TenantTopbar } from "./tenant-topbar";
import { TypeGraph } from "./type-graph";
import { VersionHistoryDrawer } from "./version-history-drawer";

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: error.title, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

/**
 * Screen 12. The server seeded the query cache; this owns the draft being
 * edited, the validate/stage mutations and the version-history drawer.
 */
export function AuthorizationModelView({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const { data, error } = useQuery<AuthorizationModel>({
    queryKey: authzModelKeys.model(slug),
    queryFn: () => bffGet(`/api/tenants/${encodeURIComponent(slug)}/authorization-model`, AuthorizationModelSchema),
  });

  // null = follow the server draft; a string = local edits not yet staged.
  const [localDraft, setLocalDraft] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [staged, setStaged] = useState<StageResult | null>(null);

  const validate = useMutation({
    mutationFn: (dsl: string) =>
      bffMutate(
        `/api/tenants/${encodeURIComponent(slug)}/authorization-model/validate`,
        { body: { dsl } },
        ValidationResultSchema,
      ),
    onSuccess: (result) => setValidation(result),
  });

  const stage = useMutation({
    mutationFn: (dsl: string) =>
      bffMutate(`/api/tenants/${encodeURIComponent(slug)}/authorization-model`, { body: { dsl } }, StageResultSchema),
    onSuccess: async (result) => {
      setStaged(result);
      setLocalDraft(null);
      // Staging is a spec write: tenant, spec versions and runs all change.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authzModelKeys.all(slug) }),
        queryClient.invalidateQueries({ queryKey: ["tenant", slug] }),
        queryClient.invalidateQueries({ queryKey: ["spec", slug] }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
      ]);
    },
  });

  if (!data) {
    return (
      <>
        <TenantTopbar slug={slug} title="Authorization model" />
        <div className="p-6">
          <ProblemNotice title="Authorization model unavailable" detail={error instanceof Error ? error.message : "no data"} />
        </div>
      </>
    );
  }

  const draft = localDraft ?? data.draft;
  const draftVersion = data.draftVersion ?? data.liveVersion + 1;
  const parsed = parseModel(draft);
  const summary = summarize(parsed);
  const parses = parsed.issues.length === 0;
  const dirty = localDraft !== null && localDraft !== data.draft;

  return (
    <>
      <TenantTopbar
        slug={slug}
        title="Authorization model"
        chip={
          <Chip tone="link" className="text-[11px]">
            v{data.liveVersion} live · editing v{draftVersion}
          </Chip>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => validate.mutate(draft)} disabled={validate.isPending}>
              Validate DSL
            </Button>
            <Button variant="outline" onClick={() => setHistoryOpen(true)}>
              Version history
            </Button>
            <Button variant="primary" onClick={() => stage.mutate(draft)} disabled={!parses || stage.isPending}>
              Stage into spec
            </Button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1.1fr_1fr]">
        <section className="flex min-h-0 min-w-0 flex-col border-r border-line">
          <div className="flex items-center justify-between border-b border-line-row px-[18px] py-2.5 font-mono text-[11px] text-fg-meta">
            <span>
              model.fga
              {dirty && <span className="text-degraded"> · unsaved edits</span>}
            </span>
            <span role="status" className={parses ? "text-ready" : "text-failed"}>
              {parses
                ? `parses · ${summary.types} types · ${summary.relations} relations · depth ${summary.depth}`
                : `${parsed.issues.length} issue${parsed.issues.length === 1 ? "" : "s"} · line ${parsed.issues[0]!.line}`}
            </span>
          </div>

          {(staged || stage.error) && (
            <div className="border-b border-line-row px-[18px] py-2.5">
              {staged && (
                <p role="status" className="font-mono text-[11.5px] text-ready">
                  ✓ staged into generation {staged.generation} · v{staged.version} · the reconciler applies it when generation{" "}
                  {staged.generation} converges
                </p>
              )}
              {stage.error && <ProblemNotice {...problemOf(stage.error)} />}
            </div>
          )}

          <DslView live={data.live} draft={draft} />

          {(validation || validate.error) && (
            <div className="border-t border-line-row px-[18px] py-3">
              {validate.error && <ProblemNotice {...problemOf(validate.error)} />}
              {validation && !validate.error && (
                <div
                  role="status"
                  className={cn(
                    "flex flex-col gap-1.5 rounded-inner border p-3",
                    validation.ok ? "border-ready-border bg-ready-tint" : "border-failed-border bg-failed-tint",
                  )}
                >
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <span aria-hidden className={cn("font-mono", validation.ok ? "text-ready" : "text-failed")}>
                      {validation.ok ? "✓" : "✕"}
                    </span>
                    <span className="text-fg">
                      {validation.ok
                        ? `DSL parses · ${validation.types} types · ${validation.relations} relations · depth ${validation.depth}`
                        : `${validation.issues.length} issue${validation.issues.length === 1 ? "" : "s"} found`}
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-fg-meta">
                      POST /authorization-model/validate · {validation.elapsedMs}ms
                    </span>
                  </div>
                  {validation.ok ? (
                    <span className="font-mono text-[11px] text-fg-meta">
                      {groupThousands(validation.tuplesValidated)} existing tuples validate against this model
                    </span>
                  ) : (
                    <ul className="flex flex-col gap-0.5 font-mono text-[11.5px] text-failed">
                      {validation.issues.map((issue, i) => (
                        <li key={i}>
                          line {issue.line}: {issue.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-line-row px-[18px] py-2.5">
            <span className="font-mono text-[11px] text-fg-meta">
              {editing ? "editing v" + draftVersion + " · changes stay local until staged" : `v${draftVersion} draft · read-only view`}
            </span>
            <div className="flex items-center gap-2">
              {dirty && (
                <Button variant="outline" onClick={() => setLocalDraft(null)}>
                  Revert
                </Button>
              )}
              <Button variant={editing ? "secondary" : "outline"} onClick={() => setEditing((v) => !v)} aria-pressed={editing}>
                {editing ? "Close editor" : "Edit"}
              </Button>
            </div>
          </div>
          {editing && (
            <div className="px-[18px] pb-4">
              <label htmlFor="model-fga-editor" className="sr-only">
                model.fga draft
              </label>
              <Textarea
                id="model-fga-editor"
                value={draft}
                onChange={(e) => setLocalDraft(e.target.value)}
                spellCheck={false}
                className="min-h-[220px] text-[13px] leading-[2]"
              />
            </div>
          )}
        </section>

        <aside className="flex min-h-0 min-w-0 flex-col bg-panel">
          <div className="border-b border-line-row px-[18px] py-2.5 font-mono text-[11px] text-fg-meta">TYPE GRAPH</div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
            <TypeGraph live={data.live} draft={draft} draftVersion={draftVersion} tupleCount={data.tupleCount} />
          </div>
        </aside>
      </div>

      <VersionHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} versions={data.versions} />
    </>
  );
}
