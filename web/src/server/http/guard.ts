import { currentOperator } from "@/server/auth/operator";
import type { Session } from "@/server/session";
import { problem, sameOrigin } from "./problem";

type Guarded =
  | { ok: true; operator: Session; idempotencyKey: string | null }
  | { ok: false; response: Response };

/**
 * Route-handler guard. GET: session required. Non-GET: session, same Origin,
 * and an Idempotency-Key header (handoff "Mutations"). Returns a problem+json
 * response for the caller to return as-is when the check fails.
 */
export async function guardRoute(request: Request): Promise<Guarded> {
  const operator = await currentOperator();
  if (!operator) return { ok: false, response: problem(401, "Not signed in") };

  if (request.method !== "GET" && request.method !== "HEAD") {
    if (!sameOrigin(request)) {
      return { ok: false, response: problem(403, "Cross-origin request rejected") };
    }
    const key = request.headers.get("idempotency-key");
    if (!key) {
      return {
        ok: false,
        response: problem(400, "Idempotency-Key required", "Every mutation must carry an Idempotency-Key header."),
      };
    }
    return { ok: true, operator, idempotencyKey: key };
  }
  return { ok: true, operator, idempotencyKey: null };
}

/** Parse a JSON body against a schema, or produce a 400 problem. */
export async function parseBody<T>(
  request: Request,
  parse: (input: unknown) => { success: true; data: T } | { success: false; error: { message: string } },
): Promise<{ ok: true; data: T } | { ok: false; response: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, response: problem(400, "Invalid JSON body") };
  }
  const result = parse(json);
  if (!result.success) return { ok: false, response: problem(400, "Validation failed", result.error.message) };
  return { ok: true, data: result.data };
}
