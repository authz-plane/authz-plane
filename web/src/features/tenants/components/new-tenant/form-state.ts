import { deriveSlug } from "../../slug";
import type { CreateTenantInput, StarterModel, StartFrom } from "../../schemas";
import type { SpecPreviewInput } from "../../spec-preview";

/**
 * Screen 19 form model as a pure reducer, so the wizard's rules (slug follows
 * the display name until edited, defaults per the frame) are testable without
 * rendering anything.
 */
export interface NewTenantForm {
  displayName: string;
  slug: string;
  /** once the operator types into the slug field it stops following the name */
  slugEdited: boolean;
  startFrom: StartFrom;
  copyFromSlug: string;
  yaml: string;
  starterModel: StarterModel;
  autoHeal: boolean;
  resyncIntervalSeconds: number;
}

export const INITIAL_FORM: NewTenantForm = {
  displayName: "",
  slug: "",
  slugEdited: false,
  startFrom: "blank",
  copyFromSlug: "",
  yaml: "",
  starterModel: "roles-only",
  autoHeal: false,
  resyncIntervalSeconds: 600,
};

export type FormAction =
  | { type: "displayName"; value: string }
  | { type: "slug"; value: string }
  | { type: "startFrom"; value: StartFrom }
  | { type: "copyFromSlug"; value: string }
  | { type: "yaml"; value: string }
  | { type: "starterModel"; value: StarterModel }
  | { type: "autoHeal"; value: boolean }
  | { type: "resyncIntervalSeconds"; value: number };

export function formReducer(form: NewTenantForm, action: FormAction): NewTenantForm {
  switch (action.type) {
    case "displayName":
      return {
        ...form,
        displayName: action.value,
        slug: form.slugEdited ? form.slug : deriveSlug(action.value),
      };
    case "slug": {
      // Clearing the field hands control back to the display name on its next change.
      const slug = action.value.toLowerCase();
      return { ...form, slug, slugEdited: slug !== "" };
    }
    case "startFrom":
      return { ...form, startFrom: action.value };
    case "copyFromSlug":
      return { ...form, copyFromSlug: action.value };
    case "yaml":
      return { ...form, yaml: action.value };
    case "starterModel":
      return { ...form, starterModel: action.value };
    case "autoHeal":
      return { ...form, autoHeal: action.value };
    case "resyncIntervalSeconds":
      return { ...form, resyncIntervalSeconds: action.value };
  }
}

export type SlugStatus =
  | { kind: "empty" }
  | { kind: "invalid"; reason: string }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken"; reason: string }
  | { kind: "error"; reason: string };

/** The identity step is complete once there is a name and the slug is confirmed available. */
export function identityComplete(form: NewTenantForm, slug: SlugStatus): boolean {
  if (form.displayName.trim().length === 0) return false;
  if (slug.kind !== "available") return false;
  if (form.startFrom === "copy" && !form.copyFromSlug) return false;
  if (form.startFrom === "yaml" && form.yaml.trim().length === 0) return false;
  return true;
}

export function toSpecInput(form: NewTenantForm): SpecPreviewInput {
  return {
    displayName: form.displayName,
    slug: form.slug,
    startFrom: form.startFrom,
    ...(form.startFrom === "copy" && form.copyFromSlug ? { copyFromSlug: form.copyFromSlug } : {}),
    ...(form.startFrom === "yaml" && form.yaml.trim() ? { yaml: form.yaml } : {}),
    starterModel: form.starterModel,
    autoHeal: form.autoHeal,
    resyncIntervalSeconds: form.resyncIntervalSeconds,
  };
}

/** Body for POST /api/tenants. Same shape the spec preview renders, so what you see is what gets written. */
export function toCreateInput(form: NewTenantForm): CreateTenantInput {
  return {
    displayName: form.displayName.trim(),
    slug: form.slug,
    startFrom: form.startFrom,
    ...(form.startFrom === "copy" && form.copyFromSlug ? { copyFromSlug: form.copyFromSlug } : {}),
    ...(form.startFrom === "yaml" && form.yaml.trim() ? { yaml: form.yaml } : {}),
    starterModel: form.starterModel,
    autoHeal: form.autoHeal,
    resyncIntervalSeconds: form.resyncIntervalSeconds,
  };
}
