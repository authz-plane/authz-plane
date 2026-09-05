/**
 * Colour theme preference. The CSS in globals.css keys off html[data-theme]:
 * "system" leaves `color-scheme: light dark` so the OS decides; "light" and
 * "dark" pin one side. The choice lives in a plain cookie so the server can
 * render the right attribute on first paint (no flash, no inline script).
 */
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const DEFAULT_THEME: Theme = "system";
export const THEME_COOKIE = "theme";
const THEME_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export const THEME_LABELS: Record<Theme, { label: string; hint: string }> = {
  system: { label: "System", hint: "Follows the operating system's light or dark setting." },
  light: { label: "Light", hint: "Always light, whatever the operating system says." },
  dark: { label: "Dark", hint: "Always dark, the console's design default." },
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (THEMES as readonly string[]).includes(value);
}

/** Tolerant parse for cookie values: anything unrecognised falls back to the default. */
export function parseTheme(value: string | null | undefined): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

/**
 * Browser-side apply: flips the attribute the CSS keys on (instant, no reload)
 * and persists the choice for the server's next render. Not HttpOnly on
 * purpose: this cookie is a UI preference, not a credential.
 */
export function applyTheme(theme: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = theme;
  const secure = doc.location.protocol === "https:" ? "; Secure" : "";
  doc.cookie = `${THEME_COOKIE}=${theme}; Path=/; Max-Age=${THEME_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}
