import { describe, expect, it } from "vitest";
import { CreateTenantInputSchema } from "../../schemas";
import { formReducer, identityComplete, INITIAL_FORM, toCreateInput, toSpecInput, type NewTenantForm } from "./form-state";

function apply(...actions: Parameters<typeof formReducer>[1][]): NewTenantForm {
  return actions.reduce(formReducer, INITIAL_FORM);
}

describe("new tenant form reducer", () => {
  it("derives the slug from the display name until the slug is edited", () => {
    const named = apply({ type: "displayName", value: "Vertex Freight" });
    expect(named.slug).toBe("vertex-freight");
    expect(named.slugEdited).toBe(false);

    const edited = formReducer(named, { type: "slug", value: "VERTEX" });
    expect(edited.slug).toBe("vertex");
    expect(edited.slugEdited).toBe(true);

    const renamed = formReducer(edited, { type: "displayName", value: "Vertex Freight Ltd" });
    expect(renamed.slug).toBe("vertex");
  });

  it("clearing the slug hands control back to the display name on its next change", () => {
    const cleared = apply(
      { type: "displayName", value: "Vertex Freight" },
      { type: "slug", value: "custom" },
      { type: "slug", value: "" },
    );
    expect(cleared.slug).toBe("");
    expect(cleared.slugEdited).toBe(false);
    expect(formReducer(cleared, { type: "displayName", value: "Vertex Freight Ltd" }).slug).toBe("vertex-freight-ltd");
  });

  it("carries the frame's defaults: blank spec, roles-only, auto-heal off, 600s", () => {
    expect(INITIAL_FORM).toMatchObject({ startFrom: "blank", starterModel: "roles-only", autoHeal: false, resyncIntervalSeconds: 600 });
  });
});

describe("identityComplete", () => {
  const ready = apply({ type: "displayName", value: "Vertex Freight" });

  it("needs a name and an available slug", () => {
    expect(identityComplete(INITIAL_FORM, { kind: "empty" })).toBe(false);
    expect(identityComplete(ready, { kind: "checking" })).toBe(false);
    expect(identityComplete(ready, { kind: "taken", reason: "taken" })).toBe(false);
    expect(identityComplete(ready, { kind: "available" })).toBe(true);
  });

  it("copy needs a source tenant and yaml needs a body", () => {
    expect(identityComplete(formReducer(ready, { type: "startFrom", value: "copy" }), { kind: "available" })).toBe(false);
    expect(
      identityComplete(
        [{ type: "startFrom", value: "copy" } as const, { type: "copyFromSlug", value: "acme-air" } as const].reduce(formReducer, ready),
        { kind: "available" },
      ),
    ).toBe(true);
    expect(identityComplete(formReducer(ready, { type: "startFrom", value: "yaml" }), { kind: "available" })).toBe(false);
  });
});

describe("toCreateInput / toSpecInput", () => {
  it("produces a valid POST body and omits copy/yaml fields that do not apply", () => {
    const form = apply({ type: "displayName", value: "  Vertex Freight " }, { type: "copyFromSlug", value: "acme-air" });
    const input = toCreateInput(form);
    expect(input).toEqual({
      displayName: "Vertex Freight",
      slug: "vertex-freight",
      startFrom: "blank",
      starterModel: "roles-only",
      autoHeal: false,
      resyncIntervalSeconds: 600,
    });
    expect(CreateTenantInputSchema.safeParse(input).success).toBe(true);
    expect(toSpecInput(form).copyFromSlug).toBeUndefined();
  });

  it("includes copyFrom when copying", () => {
    const form = apply(
      { type: "displayName", value: "Vertex Freight" },
      { type: "startFrom", value: "copy" },
      { type: "copyFromSlug", value: "acme-air" },
    );
    expect(toCreateInput(form).copyFromSlug).toBe("acme-air");
    expect(toSpecInput(form).copyFromSlug).toBe("acme-air");
  });
});
