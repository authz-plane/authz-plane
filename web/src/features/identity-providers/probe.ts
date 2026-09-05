import type { IdpKind, ProbeResult } from "./schemas";

/**
 * Pure, deterministic stand-in for the SSRF-guarded discovery probe the
 * control plane runs when an issuer is saved (frame 16 footer): https only,
 * the resolved address is checked against private, loopback, link-local and
 * CGNAT ranges, redirects are refused, 3s timeout. There is no network here;
 * "resolution" is a rule over the hostname so the fixture behaves the same on
 * every machine. Hostnames containing `redirect` or `slow` simulate the two
 * non-address failures.
 */

export const SSRF_POLICY =
  "https only · DNS resolved and checked against private, loopback, link-local and CGNAT ranges · no redirects · 3s timeout";

export const BLOCKED_REASON = "blocked by SSRF guard";

const BLOCKED_SUFFIXES = [".internal", ".local", ".localhost", ".home.arpa", ".intranet", ".corp", ".lan"];

function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function parseIpv4(host: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1).map(Number) as [number, number, number, number];
  return parts.every((p) => p <= 255) ? parts : null;
}

/** Why a resolved address is refused, or null when it is publicly routable. */
export function privateRangeOf(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "0.0.0.0" || host === "::" || host === "::1") return "loopback";
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) return "private DNS suffix";
  if (host.includes(":")) {
    if (host.startsWith("fe80:")) return "link-local (fe80::/10)";
    if (/^f[cd][0-9a-f]{2}:/.test(host)) return "private (fc00::/7)";
    if (host.startsWith("::ffff:")) return privateRangeOf(host.slice(7));
    return null;
  }
  const v4 = parseIpv4(host);
  if (!v4) return null;
  const [a, b] = v4;
  if (a === 10) return "private (10.0.0.0/8)";
  if (a === 127) return "loopback (127.0.0.0/8)";
  if (a === 0) return "this-network (0.0.0.0/8)";
  if (a === 169 && b === 254) return "link-local (169.254.0.0/16)";
  if (a === 100 && b >= 64 && b <= 127) return "CGNAT (100.64.0.0/10)";
  if (a === 192 && b === 168) return "private (192.168.0.0/16)";
  if (a === 172 && b >= 16 && b <= 31) return "private (172.16.0.0/12)";
  if (a >= 224) return "multicast / reserved";
  return null;
}

function blocked(issuer: string, reason: string, detail: string): ProbeResult {
  return { ok: false, issuer, reason, detail, checks: [{ label: detail, ok: false }] };
}

/** Frame 16 shows Entra's address family; everything else lands in the TEST-NET-3 documentation range. */
function publicIpFor(host: string): string {
  if (host.endsWith("microsoftonline.com")) return "20.190.x.x";
  if (host.endsWith("accounts.google.com")) return "142.250.x.x";
  return `203.0.113.${(hashOf(host) % 254) + 1}`;
}

export function probeIssuer(issuer: string, kind: IdpKind = "oidc"): ProbeResult {
  const trimmed = issuer.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return blocked(trimmed, "invalid issuer", "issuer must be an absolute URL");
  }
  if (url.protocol !== "https:") {
    return blocked(trimmed, BLOCKED_REASON, `${url.protocol.replace(":", "")} refused · https only`);
  }
  if (url.username || url.password) {
    return blocked(trimmed, BLOCKED_REASON, "credentials in the issuer URL are refused");
  }
  const host = url.hostname.toLowerCase();
  const range = privateRangeOf(host);
  if (range) {
    return blocked(trimmed, BLOCKED_REASON, `resolved address is ${range} · refused`);
  }
  if (host.includes("redirect")) {
    return blocked(trimmed, BLOCKED_REASON, "issuer answered 302 · redirects are not followed");
  }
  if (host.includes("slow")) {
    return blocked(trimmed, "timed out", "no response within 3s · timed out");
  }

  const durationMs = host.endsWith("microsoftonline.com") ? 240 : 180 + (hashOf(host) % 200);
  const resolvedIp = publicIpFor(host);
  const checks =
    kind === "saml"
      ? [
          { label: `metadata reachable · ${durationMs}ms`, ok: true },
          { label: "signing certificate present · valid until 2027-03", ok: true },
          { label: "supports HTTP-POST binding · signed assertions", ok: true },
          { label: `resolved IP is public · ${resolvedIp}`, ok: true },
        ]
      : [
          { label: `openid-configuration reachable · ${durationMs}ms`, ok: true },
          { label: "jwks_uri present · 3 signing keys", ok: true },
          { label: "supports authorization_code + PKCE (S256)", ok: true },
          { label: `resolved IP is public · ${resolvedIp}`, ok: true },
        ];
  return { ok: true, issuer: trimmed, durationMs, resolvedIp, checks };
}

/** Inline label next to the issuer field. */
export function probeInlineLabel(result: ProbeResult): string {
  return result.ok ? `discovery ok · ${result.durationMs}ms` : result.reason;
}
