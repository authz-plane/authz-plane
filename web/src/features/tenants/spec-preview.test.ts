import { describe, expect, it } from "vitest";
import { specPreviewLines, specYaml, starterRoles, type SpecPreviewInput } from "./spec-preview";

const BASE: SpecPreviewInput = {
  displayName: "Vertex Freight",
  slug: "vertex-freight",
  startFrom: "blank",
  starterModel: "roles-only",
  autoHeal: false,
  resyncIntervalSeconds: 600,
};

describe("specYaml", () => {
  it("renders the generation-1 spec exactly as frame 19 shows it", () => {
    expect(specYaml(BASE)).toBe(
      [
        "apiVersion: authzplane.dev/v1",
        "kind: Tenant",
        "metadata:",
        "  slug: vertex-freight",
        "  displayName: Vertex Freight",
        "spec:",
        "  reconcilePolicy:",
        "    autoHeal: false",
        "    resyncIntervalSeconds: 600",
        "  identityProviders: []",
        "  roles:",
        "    - key: tenant_admin",
        "    - key: tenant_viewer",
      ].join("\n"),
    );
  });

  it("uses ~ for missing identity and marks value tones", () => {
    const lines = specPreviewLines({ ...BASE, displayName: "", slug: "" });
    expect(lines.find((l) => l.key === "slug")?.value).toBe("~");
    expect(lines.find((l) => l.key === "displayName")?.value).toBe("~");
    expect(lines.find((l) => l.key === "autoHeal")?.tone).toBe("bool");
    expect(lines.find((l) => l.key === "resyncIntervalSeconds")?.tone).toBe("number");
  });

  it("adds copyFrom and the documents starter model", () => {
    const yaml = specYaml({ ...BASE, startFrom: "copy", copyFromSlug: "acme-air", starterModel: "documents" });
    expect(yaml).toContain("  copyFrom: acme-air");
    expect(yaml).toContain("    - key: tenant_editor");
    expect(yaml).toContain("  authorizationModel:\n    starter: documents\n    types: [user, organization, document]");
    expect(starterRoles("documents")).toEqual(["tenant_admin", "tenant_editor", "tenant_viewer"]);
  });

  it("passes pasted YAML through verbatim", () => {
    const pasted = "apiVersion: authzplane.dev/v1\r\nkind: Tenant\r\n";
    expect(specYaml({ ...BASE, startFrom: "yaml", yaml: pasted })).toBe("apiVersion: authzplane.dev/v1\nkind: Tenant\n");
  });
});
