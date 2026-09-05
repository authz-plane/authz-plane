import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, isTheme, parseTheme, THEMES } from "./theme";

describe("theme preference", () => {
  it("offers exactly system, light and dark", () => {
    expect(THEMES).toEqual(["system", "light", "dark"]);
  });

  it("parses each known value", () => {
    for (const t of THEMES) expect(parseTheme(t)).toBe(t);
  });

  it("falls back to the default for anything else", () => {
    expect(parseTheme(undefined)).toBe(DEFAULT_THEME);
    expect(parseTheme(null)).toBe(DEFAULT_THEME);
    expect(parseTheme("")).toBe(DEFAULT_THEME);
    expect(parseTheme("DARK")).toBe(DEFAULT_THEME);
    expect(parseTheme("solarized")).toBe(DEFAULT_THEME);
  });

  it("type-guards non-strings", () => {
    expect(isTheme(1)).toBe(false);
    expect(isTheme({})).toBe(false);
    expect(isTheme("light")).toBe(true);
  });
});
