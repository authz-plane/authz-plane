import { describe, expect, it } from "vitest";
import { FIXTURE_NOW } from "./fixtures";
import { idpLabel, relativeAge } from "./format";

describe("relativeAge", () => {
  const now = Date.parse(FIXTURE_NOW);
  const ago = (s: number) => new Date(now - s * 1000).toISOString();

  it("rounds into the buckets frame 03 uses", () => {
    expect(relativeAge(ago(10), now)).toBe("now");
    expect(relativeAge(ago(45), now)).toBe("45s ago");
    expect(relativeAge(ago(6 * 60), now)).toBe("6m ago");
    expect(relativeAge(ago(2 * 3600), now)).toBe("2h ago");
    expect(relativeAge(ago(3 * 86_400), now)).toBe("3d ago");
  });

  it("reads never for a tenant that has not reconciled", () => {
    expect(relativeAge(null, now)).toBe("never");
    expect(relativeAge("garbage", now)).toBe("—");
  });
});

describe("idpLabel", () => {
  it("maps the fixture connection string onto a vendor label", () => {
    expect(idpLabel("oidc · login.microsoftonline.com", "Ready")).toBe("Entra ID");
    expect(idpLabel("oidc · accounts.google.com", "Ready")).toBe("Google");
    expect(idpLabel("oidc · northwind.okta.com", "Failed")).toBe("Okta");
    expect(idpLabel("saml · sso.umbrella-health.example", "Ready")).toBe("SAML");
    expect(idpLabel("oidc · idp.example", "Ready")).toBe("OIDC");
  });

  it("shows finalizing for a deleting tenant without an IdP, otherwise a dash", () => {
    expect(idpLabel(null, "Deleting")).toBe("finalizing");
    expect(idpLabel(null, "Pending")).toBe("—");
  });
});
