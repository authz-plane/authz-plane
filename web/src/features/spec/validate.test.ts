import { describe, expect, it } from "vitest";
import { acmeVersions } from "./fixtures";
import { validateSpecBody, validationCaption } from "./validate";

const [gen9, gen8] = acmeVersions();

describe("validateSpecBody", () => {
  it("passes the generation-9 body with the frame's three cards: parse ok, rotation warning on line 15, SSRF ok", () => {
    const r = validateSpecBody(gen9!.body, { appliedBody: gen8!.body });
    expect(r.valid).toBe(true);
    expect(r.errors).toBe(0);
    expect(r.warnings).toBe(1);
    expect(r.lineCount).toBe(62);
    expect(r.results.map((x) => [x.level, x.title])).toEqual([
      ["ok", "Schema and FGA DSL parse cleanly"],
      ["warning", "Secret ref rotates the stored ciphertext"],
      ["ok", "issuer passed SSRF allowlist"],
    ]);
    expect(r.results[0]!.detail).toBe("3 types · 8 relations · no cycles");
    expect(r.results[1]!.line).toBe(15);
    expect(r.results[1]!.detail).toContain("write-only field, never returned by the API");
  });

  it("does not warn about rotation when the ref matches the applied generation", () => {
    const r = validateSpecBody(gen8!.body, { appliedBody: gen8!.body });
    expect(r.warnings).toBe(0);
  });

  it("warns on a literal clientSecret value", () => {
    const body = gen9!.body.replace("      clientSecretRef: acme-entra-secret", "      clientSecret: not-a-real-value");
    const r = validateSpecBody(body);
    const warn = r.results.find((x) => x.title === "Literal client secret in spec");
    expect(warn).toBeDefined();
    expect(warn!.line).toBe(15);
    expect(r.valid).toBe(true);
  });

  it("errors on broken indentation and marks the document invalid", () => {
    const odd = gen9!.body.replace("      kind: oidc", "       kind: oidc");
    const r1 = validateSpecBody(odd);
    expect(r1.valid).toBe(false);
    expect(r1.results.some((x) => x.level === "error" && x.title === "Broken indentation" && x.line === 12)).toBe(true);

    const jump = gen9!.body.replace("  reconcilePolicy:", "      reconcilePolicy:");
    const r2 = validateSpecBody(jump);
    expect(r2.valid).toBe(false);
    expect(r2.results.find((x) => x.level === "error")!.detail).toContain("past its parent");

    const tab = gen9!.body.replace("  slug: acme-air", "\tslug: acme-air");
    expect(validateSpecBody(tab).valid).toBe(false);
  });

  it("leaves the block-scalar model free of indentation rules but still counts it", () => {
    const r = validateSpecBody(gen9!.body);
    expect(r.errors).toBe(0);
    expect(r.results[0]!.detail).toContain("3 types");
  });

  it("requires the top-level keys", () => {
    const r = validateSpecBody("metadata:\n  slug: x\n");
    expect(r.valid).toBe(false);
    const titles = r.results.filter((x) => x.level === "error").map((x) => x.detail);
    expect(titles.some((d) => d.includes("apiVersion"))).toBe(true);
    expect(titles.some((d) => d.includes("spec"))).toBe(true);
  });

  it("rejects issuers that fail the SSRF allowlist", () => {
    for (const bad of ["http://login.example.com/v2.0", "https://169.254.169.254/latest", "https://localhost/", "https://10.0.0.7/", "https://100.64.1.1/"]) {
      const r = validateSpecBody(gen9!.body.replace("https://login.microsoftonline.com/acme-air.example/v2.0", bad));
      expect(r.valid, bad).toBe(false);
      expect(r.results.some((x) => x.title === "issuer rejected by SSRF guard"), bad).toBe(true);
    }
  });

  it("captions the status bar", () => {
    expect(validationCaption(null)).toBe("validating…");
    expect(validationCaption({ errors: 0, warnings: 0 })).toBe("schema ok");
    expect(validationCaption({ errors: 0, warnings: 1 })).toBe("1 warning");
    expect(validationCaption({ errors: 2, warnings: 1 })).toBe("2 errors");
  });
});
