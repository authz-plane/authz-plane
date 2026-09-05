import { NextResponse, type NextRequest } from "next/server";
import { problem } from "@/server/http/problem";
import {
  sealSession,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "@/server/session";

/**
 * Sign-in entry point (system design §10 sequence, step 1).
 *
 * AUTH_MODE=mock  writes a session for a fixture operator. Local UI work only.
 * AUTH_MODE=oidc  will generate state/nonce/PKCE, stash them in a short-lived
 *                 cookie and 302 to Zitadel's authorize endpoint. Lands with
 *                 the Zitadel compose service; until then this is a 501.
 */
export async function GET(request: NextRequest) {
  const mode = process.env.AUTH_MODE ?? "mock";

  if (mode === "oidc") {
    return problem(
      501,
      "OIDC sign-in is not configured yet",
      "Set AUTH_MODE=mock for local UI work. Authorization Code + PKCE against Zitadel lands with the Zitadel compose service.",
    );
  }

  if (mode !== "mock") {
    return problem(
      500,
      "Unknown AUTH_MODE",
      `Expected "mock" or "oidc", got "${mode}".`,
    );
  }

  if (process.env.NODE_ENV === "production") {
    return problem(403, "Mock sign-in is disabled in production");
  }

  const now = Math.floor(Date.now() / 1000);
  const cookie = await sealSession({
    // Synthetic operator, not a real person.
    sub: "user:operator",
    name: "Platform Operator",
    email: "operator@authz-plane.test",
    role: "platform superadmin",
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  });

  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(new URL(next, request.url), 303);
  res.cookies.set(
    SESSION_COOKIE,
    cookie,
    sessionCookieOptions(SESSION_TTL_SECONDS),
  );
  return res;
}

/** Only same-origin, absolute-path redirects. Anything else goes to /dashboard. */
function safeNextPath(raw: string | null): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/api")
  ) {
    return "/dashboard";
  }
  return raw;
}
