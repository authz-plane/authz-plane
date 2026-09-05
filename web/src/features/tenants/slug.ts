import { RESERVED_SLUGS, SLUG_MAX, SLUG_MIN, SLUG_PATTERN } from "./schemas";

/**
 * Slug helpers for screen 19. The slug is immutable once created (it keys
 * every tuple, index and audit row), so the form derives a sensible default
 * from the display name and validates synchronously before the async
 * availability check runs.
 */

// Combining diacritical marks block (U+0300–U+036F), left behind by NFKD.
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

/** "Vertex Freight" → "vertex-freight". Strips diacritics, collapses runs, trims hyphens, caps length. */
export function deriveSlug(displayName: string): string {
  return displayName
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}

/** Returns a short problem statement, or null when the slug is well-formed. */
export function validateSlug(slug: string): string | null {
  if (slug.length === 0) return "enter a slug";
  if (slug.length < SLUG_MIN) return `at least ${SLUG_MIN} characters`;
  if (slug.length > SLUG_MAX) return `at most ${SLUG_MAX} characters`;
  if (!SLUG_PATTERN.test(slug)) {
    return "lowercase letters, digits and hyphens; must start and end with a letter or digit";
  }
  if (RESERVED_SLUGS.includes(slug)) return "reserved";
  return null;
}
