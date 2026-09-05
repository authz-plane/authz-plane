import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { openSession, SESSION_COOKIE, type Session } from "@/server/session";

/** Reads the signed-in operator inside server components and route handlers. */
export async function currentOperator(): Promise<Session | null> {
  const jar = await cookies();
  return openSession(jar.get(SESSION_COOKIE)?.value);
}

/** Server-component guard. The proxy already redirects; this is belt and braces. */
export async function requireOperator(): Promise<Session> {
  const session = await currentOperator();
  if (!session) redirect("/login");
  return session;
}
