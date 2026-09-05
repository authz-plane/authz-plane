import { NextResponse, type NextRequest } from "next/server";
import { openSession, SESSION_COOKIE } from "@/server/session";

/**
 * Optimistic session check at the edge of the app. Reads the cookie only, no
 * network. Route handlers and server components re-check with requireOperator.
 */
const PUBLIC_PATHS = new Set(["/login"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await openSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  if (PUBLIC_PATHS.has(pathname)) {
    if (session) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!session) {
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  // Pages only. /api routes answer 401 problem+json themselves; static assets pass through.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|woff2?)$).*)",
  ],
};
