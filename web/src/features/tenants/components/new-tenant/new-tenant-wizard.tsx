"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useReducer } from "react";
import { SplitBody } from "@/components/layout/page-header";
import { Button, LinkButton } from "@/components/ui/button";
import { useCreateTenant, useSlugCheck } from "../../hooks";
import { parseWizardStep, StepRail, WIZARD_STEPS, type WizardStep } from "../step-rail";
import { AuthorizationStep } from "./authorization-step";
import { formReducer, identityComplete, INITIAL_FORM, toCreateInput, toSpecInput } from "./form-state";
import { IdentityStep, type TenantOption } from "./identity-step";
import { ReviewStep } from "./review-step";
import { SpecPreviewPanel } from "./spec-preview-panel";

const BASE_PATH = "/tenants/new";

export function wizardHref(step: WizardStep): string {
  return step === "identity" ? BASE_PATH : `${BASE_PATH}?step=${step}`;
}

/**
 * Screen 19. One client component owns the form for all three steps; the
 * current step lives in `?step=` and moves with the History API (which Next
 * syncs into useSearchParams) so the URL is shareable and back/forward work
 * without a server round-trip that would remount the form. A fresh load on
 * ?step=review starts at identity anyway, because there is nothing to review
 * yet.
 */
export function NewTenantWizard({ tenantOptions }: { tenantOptions: TenantOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = parseWizardStep(searchParams.get("step") ?? undefined);

  const [form, dispatch] = useReducer(formReducer, INITIAL_FORM);
  const slugStatus = useSlugCheck(form.slug);
  const identityDone = identityComplete(form, slugStatus);
  const create = useCreateTenant();

  const reachable = (target: WizardStep) => target === "identity" || identityDone;
  const step: WizardStep = reachable(urlStep) ? urlStep : "identity";

  // A deep link into a step that has no data yet falls back to identity; keep the URL honest.
  useEffect(() => {
    if (urlStep !== "identity" && !identityDone) window.history.replaceState(null, "", wizardHref("identity"));
  }, [urlStep, identityDone]);

  function goTo(next: WizardStep) {
    if (!reachable(next)) return;
    window.history.pushState(null, "", wizardHref(next));
  }

  const specInput = useMemo(() => toSpecInput(form), [form]);
  const index = WIZARD_STEPS.indexOf(step);
  const previous = index > 0 ? WIZARD_STEPS[index - 1] : undefined;

  function submit() {
    create.mutate(toCreateInput(form), {
      onSuccess: (created) => router.push(`/tenants/${created.slug}`),
    });
  }

  return (
    <>
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-6">
        <h1 className="text-[15px] font-semibold text-fg">New tenant</h1>
        <div className="flex items-center gap-3.5">
          <StepRail current={step} />
          <Link
            href="/tenants"
            aria-label="Close"
            className="ml-2 rounded-[5px] px-1.5 py-0.5 font-mono text-[12px] text-fg-meta transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
          >
            ✕
          </Link>
        </div>
      </header>

      <SplitBody panelWidth={400} panel={<SpecPreviewPanel input={specInput} />}>
        <form
          className="flex min-h-full flex-col gap-[22px] px-10 py-8"
          aria-label={`New tenant · ${step}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (step === "identity") goTo("authorization");
            else if (step === "authorization") goTo("review");
            else if (!create.isPending) submit();
          }}
        >
          {step === "identity" && (
            <IdentityStep form={form} slugStatus={slugStatus} tenantOptions={tenantOptions} dispatch={dispatch} />
          )}
          {step === "authorization" && <AuthorizationStep form={form} dispatch={dispatch} />}
          {step === "review" && <ReviewStep form={form} error={create.error} />}

          <div className="mt-auto flex items-center gap-2.5 pt-2">
            {previous ? (
              <Button type="button" variant="outline" size="md" onClick={() => goTo(previous)}>
                ← Back
              </Button>
            ) : (
              <LinkButton href="/tenants" variant="outline" size="md">
                Cancel
              </LinkButton>
            )}
            {step === "identity" && (
              <Button type="submit" variant="primary" size="md" disabled={!identityDone}>
                Continue to authorization
              </Button>
            )}
            {step === "authorization" && (
              <Button type="submit" variant="primary" size="md">
                Continue to review
              </Button>
            )}
            {step === "review" && (
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={create.isPending}
                aria-busy={create.isPending || undefined}
              >
                {create.isPending ? "Creating…" : "Create tenant"}
              </Button>
            )}
            {step === "identity" && !identityDone && (
              <span className="font-mono text-[11px] text-fg-meta">name and an available slug are required</span>
            )}
          </div>
        </form>
      </SplitBody>
    </>
  );
}
