import type { Phase } from "./schemas";

/**
 * Presentation helpers for the tenants table. Deterministic given `now`, so
 * the server render and the hydrated client agree.
 */

/** "45s ago" / "6m ago" / "2h ago" / "now" / "never". Under 30s reads as "now". */
export function relativeAge(iso: string | null, now: string | number | Date): string {
  if (!iso) return "never";
  const then = Date.parse(iso);
  const at = typeof now === "number" ? now : new Date(now).getTime();
  if (Number.isNaN(then) || Number.isNaN(at)) return "—";
  const seconds = Math.floor((at - then) / 1000);
  if (seconds < 30) return "now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * The IDP column shows a vendor name, not the connection string. Maps the
 * fixture's "kind · host" onto the labels frame 03 uses.
 */
export function idpLabel(idp: string | null, phase: Phase): string {
  if (!idp) return phase === "Deleting" ? "finalizing" : "—";
  const [kind = "", host = ""] = idp.split("·").map((s) => s.trim());
  if (host.includes("microsoftonline")) return "Entra ID";
  if (host.includes("google")) return "Google";
  if (host.includes("okta")) return "Okta";
  if (kind.toLowerCase() === "saml") return "SAML";
  return kind ? kind.toUpperCase() : "—";
}
