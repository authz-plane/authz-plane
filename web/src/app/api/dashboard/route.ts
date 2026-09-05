import type { NextRequest } from "next/server";
import { DEFAULT_WINDOW, WindowSchema } from "@/features/dashboard/schemas";
import { currentOperator } from "@/server/auth/operator";
import { getDashboardOverview } from "@/features/dashboard/server";
import { problem } from "@/server/http/problem";

/** Polled by the overview screen. Cookie auth only; nothing here reaches the browser as a token. */
export async function GET(request: NextRequest) {
  const operator = await currentOperator();
  if (!operator) return problem(401, "Not signed in");

  const parsed = WindowSchema.safeParse(
    request.nextUrl.searchParams.get("window") ?? DEFAULT_WINDOW,
  );
  if (!parsed.success) {
    return problem(
      400,
      "Invalid window",
      `Expected one of ${WindowSchema.options.join(", ")}.`,
    );
  }

  const overview = await getDashboardOverview(parsed.data);
  return Response.json(overview, {
    headers: { "cache-control": "no-store" },
  });
}
