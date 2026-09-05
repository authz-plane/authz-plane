/**
 * RFC 9457 problem+json responses. The .NET API speaks this shape; the BFF
 * mirrors it so the UI has one error format to render.
 */
export interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

export function problem(
  status: number,
  title: string,
  detail?: string,
  extra?: Record<string, unknown>,
): Response {
  const body: Problem & Record<string, unknown> = {
    type: "about:blank",
    title,
    status,
    ...(detail ? { detail } : {}),
    ...extra,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/problem+json" },
  });
}

/**
 * Origin check for non-GET route handlers (handoff "State Management: Auth").
 * SameSite=Lax already blocks cross-site POSTs from top-level navigations in
 * modern browsers; this closes the remaining gap without a token round-trip.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  return origin === new URL(request.url).origin;
}
