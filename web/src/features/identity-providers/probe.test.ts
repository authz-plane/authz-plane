import { describe, expect, it } from "vitest";
import { BLOCKED_REASON, privateRangeOf, probeInlineLabel, probeIssuer } from "./probe";
import { ProbeResultSchema } from "./schemas";

describe("probeIssuer", () => {
  it("passes a public https issuer with the four discovery checks", () => {
    const r = probeIssuer("https://login.microsoftonline.com/8f2c1a9e-4b7d-4e1f-9c3a-2d5b6e7f8a90/v2.0");
    expect(ProbeResultSchema.parse(r)).toEqual(r);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.durationMs).toBe(240);
    expect(r.resolvedIp).toBe("20.190.x.x");
    expect(r.checks.map((c) => c.label)).toEqual([
      "openid-configuration reachable · 240ms",
      "jwks_uri present · 3 signing keys",
      "supports authorization_code + PKCE (S256)",
      "resolved IP is public · 20.190.x.x",
    ]);
    expect(probeInlineLabel(r)).toBe("discovery ok · 240ms");
  });

  it("refuses plain http", () => {
    const r = probeIssuer("http://login.microsoftonline.com/common/v2.0");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(BLOCKED_REASON);
    expect(r.detail).toBe("http refused · https only");
    expect(probeInlineLabel(r)).toBe("blocked by SSRF guard");
  });

  it.each([
    ["https://localhost/", "loopback"],
    ["https://127.0.0.1/", "loopback (127.0.0.0/8)"],
    ["https://10.4.0.12/oidc", "private (10.0.0.0/8)"],
    ["https://169.254.169.254/latest/meta-data", "link-local (169.254.0.0/16)"],
    ["https://100.64.3.1/", "CGNAT (100.64.0.0/10)"],
    ["https://192.168.1.10/", "private (192.168.0.0/16)"],
    ["https://172.20.0.5/", "private (172.16.0.0/12)"],
    ["https://sso.corp.internal/", "private DNS suffix"],
    ["https://[::1]/", "loopback"],
    ["https://[fd12:3456::1]/", "private (fc00::/7)"],
    ["https://[fe80::1]/", "link-local (fe80::/10)"],
  ])("blocks %s as %s", (issuer, range) => {
    const r = probeIssuer(issuer);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toBe(BLOCKED_REASON);
    expect(r.detail).toBe(`resolved address is ${range} · refused`);
    expect(r.checks).toEqual([{ label: r.detail, ok: false }]);
  });

  it("lets public and CGNAT-adjacent addresses through", () => {
    expect(privateRangeOf("100.63.255.255")).toBeNull();
    expect(privateRangeOf("100.128.0.1")).toBeNull();
    expect(privateRangeOf("172.32.0.1")).toBeNull();
    expect(privateRangeOf("accounts.google.com")).toBeNull();
    const r = probeIssuer("https://accounts.google.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.resolvedIp).toBe("142.250.x.x");
  });

  it("refuses redirects, credentials, and reports timeouts", () => {
    const redirect = probeIssuer("https://redirect.idp.example/");
    expect(redirect).toMatchObject({ ok: false, reason: BLOCKED_REASON, detail: "issuer answered 302 · redirects are not followed" });
    const creds = probeIssuer("https://user:pw@idp.example/");
    expect(creds).toMatchObject({ ok: false, reason: BLOCKED_REASON });
    const slow = probeIssuer("https://slow.idp.example/");
    expect(slow).toMatchObject({ ok: false, reason: "timed out" });
  });

  it("rejects something that is not a URL", () => {
    expect(probeIssuer("not a url")).toMatchObject({ ok: false, reason: "invalid issuer" });
  });

  it("is deterministic and produces saml checks for saml", () => {
    const a = probeIssuer("https://sso.umbrella-health.example/saml/metadata", "saml");
    const b = probeIssuer("https://sso.umbrella-health.example/saml/metadata", "saml");
    expect(a).toEqual(b);
    if (!a.ok) return;
    expect(a.checks[0]!.label).toMatch(/^metadata reachable · \d+ms$/);
    expect(a.resolvedIp).toMatch(/^203\.0\.113\.\d+$/);
  });
});
