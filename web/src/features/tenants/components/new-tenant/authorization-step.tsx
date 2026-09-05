"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { StarterModelSchema, type StarterModel } from "../../schemas";
import { STARTER_MODEL_LABELS, starterRoles } from "../../spec-preview";
import type { FormAction, NewTenantForm } from "./form-state";

const TYPES: Record<StarterModel, string> = {
  "roles-only": "tenant",
  documents: "user · organization · document",
};

/** Step 2: pick the starter authorization model generation 1 ships with. Two radio cards. */
export function AuthorizationStep({
  form,
  dispatch,
}: {
  form: NewTenantForm;
  dispatch: (action: FormAction) => void;
}) {
  const id = useId();
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-[20px] font-semibold leading-tight text-fg">Authorization</h2>
        <p className="max-w-[520px] text-[13.5px] leading-[1.55] text-fg-secondary">
          Pick the starter model generation 1 is written with. Roles become OpenFGA relations on the tenant object;
          you can replace the whole model with a new version later.
        </p>
      </div>

      <fieldset className="flex max-w-[620px] flex-col gap-2.5">
        <legend className="mb-[7px] text-[12px] text-fg-secondary">Starter model</legend>
        {StarterModelSchema.options.map((model) => {
          const selected = form.starterModel === model;
          const label = STARTER_MODEL_LABELS[model];
          return (
            <label
              key={model}
              className={cn(
                "flex cursor-pointer items-start gap-3.5 rounded-inner border p-4 transition-colors duration-[120ms]",
                selected ? "border-line-focus bg-input-focus-bg" : "border-line hover:border-line-control",
              )}
            >
              <input
                type="radio"
                name={`${id}-starter`}
                value={model}
                checked={selected}
                onChange={() => dispatch({ type: "starterModel", value: model })}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn("font-mono text-[13px] leading-[1.5]", selected ? "text-link" : "text-fg-meta")}
              >
                {selected ? "●" : "○"}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={cn("text-[13px] font-medium", selected ? "text-fg" : "text-fg-secondary")}>
                  {label.title}
                </span>
                <span className="text-[11.5px] text-fg-meta">{label.summary}</span>
                <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-fg-meta">
                  <span>
                    types <span className="text-fg-code">{TYPES[model]}</span>
                  </span>
                  <span>
                    roles <span className="text-fg-code">{starterRoles(model).join(", ")}</span>
                  </span>
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </>
  );
}
