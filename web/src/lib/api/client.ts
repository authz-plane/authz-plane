import type { z } from "zod";

/**
 * Browser-side fetcher for the BFF routes under /api. Same-origin, cookie
 * auth only. There is no token for this code to attach, by design.
 */
export class BffError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
  ) {
    super(detail ?? title);
    this.name = "BffError";
  }
}

async function throwProblem(res: Response): Promise<never> {
  // RFC 9457 problem+json when the BFF produced it; fall back to status text.
  const problem = (await res.json().catch(() => null)) as {
    title?: string;
    detail?: string;
  } | null;
  throw new BffError(res.status, problem?.title ?? res.statusText, problem?.detail);
}

export async function bffGet<S extends z.ZodType>(path: string, schema: S): Promise<z.output<S>> {
  const res = await fetch(path, {
    headers: { accept: "application/json" },
    credentials: "same-origin",
  });
  if (!res.ok) await throwProblem(res);
  return schema.parse(await res.json());
}

/** RFC 4122 v4 id for Idempotency-Key. */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Mutations: every non-GET carries an Idempotency-Key (handoff "Mutations")
 * and the browser's Origin header, which the route handler checks. Pass a
 * schema for the response when the call returns a body; `null` for 202/204.
 */
export async function bffMutate<S extends z.ZodType | null>(
  path: string,
  init: { method?: "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; headers?: Record<string, string> },
  schema: S,
): Promise<S extends z.ZodType ? z.output<S> : null> {
  const res = await fetch(path, {
    method: init.method ?? "POST",
    credentials: "same-origin",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "idempotency-key": idempotencyKey(),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!res.ok) await throwProblem(res);
  if (!schema || res.status === 204) return null as never;
  return schema.parse(await res.json()) as never;
}
