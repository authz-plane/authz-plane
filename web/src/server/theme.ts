import { cookies } from "next/headers";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

/** Reads the operator's theme preference for server components; unknown or missing means "system". */
export async function currentTheme(): Promise<Theme> {
  const jar = await cookies();
  return parseTheme(jar.get(THEME_COOKIE)?.value);
}
