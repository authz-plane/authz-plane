import { ProblemNotice } from "@/components/states/system-states";
import { FactList, Well, WellLine } from "@/components/ui/well";
import { BffError } from "@/lib/api/client";
import { specYaml, STARTER_MODEL_LABELS } from "../../spec-preview";
import { toSpecInput, type NewTenantForm } from "./form-state";

const START_FROM_LABEL = { blank: "blank spec", copy: "copy from tenant", yaml: "pasted YAML" } as const;

/** Step 3: what generation 1 will write, verbatim, plus the create error if the POST was refused. */
export function ReviewStep({ form, error }: { form: NewTenantForm; error: Error | null }) {
  const yaml = specYaml(toSpecInput(form));
  const lines = yaml.split("\n");
  const startFrom =
    form.startFrom === "copy" && form.copyFromSlug
      ? `${START_FROM_LABEL.copy} · ${form.copyFromSlug}`
      : START_FROM_LABEL[form.startFrom];

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[20px] font-semibold leading-tight text-fg">Review plan</h2>
        <p className="max-w-[520px] text-[13.5px] leading-[1.55] text-fg-secondary">
          Creating writes generation 1 as Pending and enqueues the first reconcile. Nothing reaches Zitadel or OpenFGA
          until that run applies.
        </p>
      </div>

      {error &&
        (error instanceof BffError ? (
          <ProblemNotice title={`${error.status} · ${error.title}`} detail={error.detail} className="max-w-[620px]" />
        ) : (
          <ProblemNotice title="Create failed" detail={error.message} className="max-w-[620px]" />
        ))}

      <FactList
        labelWidth={132}
        className="max-w-[620px]"
        items={[
          { label: "slug", value: form.slug },
          { label: "display name", value: form.displayName.trim() },
          { label: "start from", value: startFrom },
          { label: "starter model", value: STARTER_MODEL_LABELS[form.starterModel].title },
          { label: "auto-heal", value: form.autoHeal ? "on" : "off", tone: form.autoHeal ? "text-ready" : undefined },
          { label: "resync interval", value: `${form.resyncIntervalSeconds}s` },
          { label: "generation", value: "1 · phase Pending" },
        ]}
      />

      <Well aria-label="Generation 1 spec" className="max-w-[620px] text-[12px] leading-[1.95]">
        {lines.map((line, i) => (
          <WellLine key={i}>{line || " "}</WellLine>
        ))}
      </Well>
    </>
  );
}
