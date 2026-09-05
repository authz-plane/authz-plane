import { cn } from "@/lib/cn";

export const WIZARD_STEPS = ["identity", "authorization", "review"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

const LABELS: Record<WizardStep, string> = {
  identity: "1 identity",
  authorization: "2 authorization",
  review: "3 review plan",
};

export function parseWizardStep(raw: string | string[] | undefined): WizardStep {
  return typeof raw === "string" && (WIZARD_STEPS as readonly string[]).includes(raw)
    ? (raw as WizardStep)
    : "identity";
}

/** Mono step rail from frame 19: `1 identity → 2 authorization → 3 review plan`, current step in link blue. */
export function StepRail({ current }: { current: WizardStep }) {
  return (
    <ol aria-label="Steps" className="flex items-center gap-3.5 font-mono text-[11.5px]">
      {WIZARD_STEPS.map((step, i) => (
        <li key={step} className="flex items-center gap-3.5">
          {i > 0 && (
            <span aria-hidden className="text-line-disabled">
              →
            </span>
          )}
          <span aria-current={step === current ? "step" : undefined} className={cn(step === current ? "text-link" : "text-fg-meta")}>
            {LABELS[step]}
          </span>
        </li>
      ))}
    </ol>
  );
}
