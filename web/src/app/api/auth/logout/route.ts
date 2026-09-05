import { NextResponse, type NextRequest } from "next/server";
import { problem, sameOrigin } from "@/server/http/problem";
import { SESSION_COOKIE, sessionCookieOptions } from "@/server/session";

/**
 * Clears the session cookie. POST only, with an Origin check, so a cross-site
 * link cannot sign the operator out.
 */
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return problem(403, "Cross-origin request rejected");
  }
  const res = NextResponse.redirect(new URL("/login", request.url), 303);
  res.cookies.set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return res;
}
