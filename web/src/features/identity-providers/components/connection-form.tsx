"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ProblemNotice } from "@/components/states/system-states";
import { AlertStrip } from "@/components/ui/alert-strip";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input, Select } from "@/components/ui/input";
import { bffMutate, BffError } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { idpKeys, specWriteKeys } from "../keys";
import { probeInlineLabel } from "../probe";
import {
  IdpKindSchema,
  ProbeResultSchema,
  StageResultSchema,
  type IdentityProvider,
  type IdpKind,
  type IdpPatch,
  type ProbeResult,
  type StageResult,
} from "../schemas";

interface Draft {
  name: string;
  kind: IdpKind;
  issuer: string;
  clientId: string;
}

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Request failed", detail: error instanceof Error ? error.message : undefined };
}

function FieldLabel({ htmlFor, children, suffix }: { htmlFor: string; children: React.ReactNode; suffix?: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[12px] text-fg-secondary">
      {children}
      {suffix}
    </label>
  );
}

/**
 * Right side of frame 16. The form edits desired state: Stage into spec
 * PATCHes the connection and the reconciler creates it in Zitadel when the
 * next generation applies. The issuer runs the SSRF-guarded probe on blur and
 * shows the result inline. The client secret is write-only: the component is
 * never handed a value, renders a mask while one is stored, and "replace"
 * reveals an empty password input.
 */
export function ConnectionForm({ slug, idp, specGeneration }: { slug: string; idp: IdentityProvider; specGeneration: number }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>({ name: idp.name, kind: idp.kind, issuer: idp.issuer, clientId: idp.clientId });
  const [replacingSecret, setReplacingSecret] = useState(!idp.hasSecret);
  const [secret, setSecret] = useState("");
  const [probe, setProbe] = useState<ProbeResult | null>(idp.lastProbe);
  const [probedIssuer, setProbedIssuer] = useState(idp.lastProbe?.issuer ?? "");
  const [staged, setStaged] = useState<StageResult | null>(null);
  const nextGeneration = specGeneration + 1;
  const base = `/api/tenants/${encodeURIComponent(slug)}/identity-providers/${encodeURIComponent(idp.id)}`;

  const probeMutation = useMutation({
    mutationFn: (issuer: string) => bffMutate(`${base}/test`, { method: "POST", body: { issuer, kind: draft.kind } }, ProbeResultSchema),
    onSuccess: (result, issuer) => {
      setProbe(result);
      setProbedIssuer(issuer);
    },
  });

  const stageMutation = useMutation({
    mutationFn: (patch: IdpPatch) => bffMutate(base, { method: "PATCH", body: patch }, StageResultSchema),
    onSuccess: async (result) => {
      setStaged(result);
      setSecret("");
      setReplacingSecret(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: idpKeys.all(slug) }),
        ...specWriteKeys(slug).map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ]);
    },
  });

  const runProbe = () => {
    const issuer = draft.issuer.trim();
    if (!issuer) return;
    probeMutation.mutate(issuer);
  };

  const onIssuerBlur = () => {
    const issuer = draft.issuer.trim();
    if (!issuer || issuer === probedIssuer) return;
    runProbe();
  };

  const stage = () => {
    const patch: IdpPatch = { name: draft.name.trim(), kind: draft.kind, issuer: draft.issuer.trim(), clientId: draft.clientId.trim() };
    if (replacingSecret && secret.length > 0) patch.clientSecret = secret;
    setStaged(null);
    stageMutation.mutate(patch);
  };

  const issuerStale = draft.issuer.trim() !== probedIssuer;
  const issuerTone = probeMutation.isPending || issuerStale ? null : probe?.ok === true ? "ok" : probe?.ok === false ? "blocked" : null;
  const stageError = stageMutation.error;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label={`${idp.name} connection`}>
      <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line px-6">
        <h2 className="truncate text-[15px] font-semibold text-fg">{idp.name}</h2>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={runProbe} disabled={probeMutation.isPending || !draft.issuer.trim()}>
            {probeMutation.isPending ? "Probing…" : "Test discovery"}
          </Button>
          <Button variant="primary" size="sm" onClick={stage} disabled={stageMutation.isPending || !draft.name.trim() || !draft.issuer.trim()}>
            {stageMutation.isPending ? "Staging…" : "Stage into spec"}
          </Button>
        </div>
      </header>

      <form
        className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-auto p-6"
        aria-label={`${idp.name} connection form`}
        onSubmit={(e) => {
          e.preventDefault();
          stage();
        }}
      >
        {staged && (
          <AlertStrip
            tone="ready"
            title={`Staged into generation ${staged.generation}`}
            detail={`${staged.id} · ${staged.secretReplaced ? "secret replaced · " : ""}applies on the next reconcile`}
          />
        )}
        {stageError && <ProblemNotice {...problemOf(stageError)} onRetry={() => stageMutation.reset()} />}
        {probeMutation.error && <ProblemNotice {...problemOf(probeMutation.error)} onRetry={() => probeMutation.reset()} />}

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-[7px]">
            <FieldLabel htmlFor="idp-name">Name</FieldLabel>
            <Input
              id="idp-name"
              mono
              className="h-[38px] rounded-[8px]"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-[7px]">
            <FieldLabel htmlFor="idp-kind">Kind</FieldLabel>
            <Select
              id="idp-kind"
              mono
              className="h-[38px] rounded-[8px]"
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: IdpKindSchema.parse(e.target.value) })}
            >
              {IdpKindSchema.options.map((k) => (
                <option key={k} value={k} className="bg-elevated text-fg">
                  {k}
                </option>
              ))}
            </Select>
          </div>

          <div className="col-span-2 flex flex-col gap-[7px]">
            <FieldLabel htmlFor="idp-issuer">Issuer</FieldLabel>
            <div className="relative">
              <Input
                id="idp-issuer"
                mono
                className={cn(
                  "h-[38px] rounded-[8px] pr-44",
                  issuerTone === "ok" && "border-ready-border-strong",
                  issuerTone === "blocked" && "border-failed-border-strong",
                )}
                value={draft.issuer}
                onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
                onBlur={onIssuerBlur}
                aria-describedby="idp-issuer-probe"
                aria-invalid={issuerTone === "blocked" || undefined}
                autoComplete="off"
                spellCheck={false}
                inputMode="url"
              />
              <span
                id="idp-issuer-probe"
                role="status"
                aria-label="issuer probe"
                className={cn(
                  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 truncate font-mono text-[11px]",
                  issuerTone === "ok" ? "text-ready" : issuerTone === "blocked" ? "text-failed" : "text-fg-meta",
                )}
              >
                {probeMutation.isPending
                  ? "probing…"
                  : issuerStale
                    ? draft.issuer.trim()
                      ? "probes on blur"
                      : ""
                    : probe
                      ? probeInlineLabel(probe)
                      : ""}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-[7px]">
            <FieldLabel htmlFor="idp-client-id">Client ID</FieldLabel>
            <Input
              id="idp-client-id"
              mono
              className="h-[38px] rounded-[8px]"
              value={draft.clientId}
              onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div className="flex flex-col gap-[7px]">
            <FieldLabel htmlFor="idp-client-secret" suffix={<span className="text-degraded"> · write-only</span>}>
              Client secret
            </FieldLabel>
            {replacingSecret ? (
              <div className="flex items-center gap-2">
                <Input
                  id="idp-client-secret"
                  type="password"
                  mono
                  className="h-[38px] rounded-[8px] border-degraded-border-strong bg-degraded-tint-deep"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={idp.hasSecret ? "new secret" : "not set"}
                  autoComplete="new-password"
                  spellCheck={false}
                />
                {idp.hasSecret && (
                  <button
                    type="button"
                    className="shrink-0 font-mono text-[11px] text-fg-tertiary hover:text-fg"
                    onClick={() => {
                      setSecret("");
                      setReplacingSecret(false);
                    }}
                  >
                    keep current
                  </button>
                )}
              </div>
            ) : (
              <div
                id="idp-client-secret"
                role="group"
                aria-label="Client secret · stored, never shown"
                className="flex h-[38px] items-center justify-between rounded-[8px] border border-degraded-border-strong bg-degraded-tint-deep px-3 font-mono text-[12.5px] text-fg-secondary"
              >
                <span aria-hidden>••••••••••••••••</span>
                <span className="sr-only">a secret is stored and is never shown</span>
                <button type="button" className="font-mono text-[11px] text-degraded hover:text-fg" onClick={() => setReplacingSecret(true)}>
                  replace
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <Eyebrow>Claim mappings</Eyebrow>
          <div role="table" aria-label="Claim mappings" className="overflow-hidden rounded-inner border border-line">
            <div role="row" className="grid grid-cols-2 border-b border-line-row px-3.5 py-[11px] font-mono text-[12px] text-fg-secondary">
              <span role="columnheader">plane field</span>
              <span role="columnheader">idp claim</span>
            </div>
            {idp.claimMappings.map((m, i) => (
              <div
                key={m.planeField}
                role="row"
                className={cn("grid grid-cols-2 px-3.5 py-[11px] font-mono text-[12.5px] text-fg", i < idp.claimMappings.length - 1 && "border-b border-line-row")}
              >
                <span role="cell">{m.planeField}</span>
                <span role="cell">{m.idpClaim}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="flex flex-col gap-2.5 p-4" aria-label="Discovery probe result">
          <CardTitle className="text-[13px]">Discovery probe result</CardTitle>
          {probe ? (
            <ul className="font-mono text-[11.5px] leading-[1.9] text-fg-secondary">
              {probe.checks.map((c) => (
                <li key={c.label} className="flex gap-2">
                  <span aria-hidden className={c.ok ? "text-ready" : "text-failed"}>
                    {c.ok ? "✓" : "✕"}
                  </span>
                  <span className="sr-only">{c.ok ? "ok" : "failed"}</span>
                  <span>{c.label}</span>
                </li>
              ))}
              {!probe.ok && <li className="text-failed">{probe.reason}</li>}
            </ul>
          ) : (
            <p className="font-mono text-[11.5px] text-fg-meta">not probed yet · Test discovery runs the SSRF-guarded probe</p>
          )}
        </Card>

        <AlertStrip
          tone="link"
          className="mt-auto"
          title={`This form edits desired state only. The connection is created in Zitadel when the next reconcile applies generation ${nextGeneration}.`}
        />
      </form>
    </section>
  );
}
