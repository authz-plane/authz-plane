import { describe, expect, it } from "vitest";
import { SLUG_MAX, SlugSchema } from "./schemas";
import { deriveSlug, validateSlug } from "./slug";

describe("deriveSlug", () => {
  it("lowercases and hyphenates the display name", () => {
    expect(deriveSlug("Vertex Freight")).toBe("vertex-freight");
    expect(deriveSlug("  Acme   Air  ")).toBe("acme-air");
  });

  it("strips diacritics and punctuation, collapsing runs", () => {
    expect(deriveSlug("Café Élan & Co.")).toBe("cafe-elan-co");
    expect(deriveSlug("--Northwind__Rail!!")).toBe("northwind-rail");
  });

  it("caps at the slug maximum without a trailing hyphen", () => {
    const long = deriveSlug(`${"a".repeat(SLUG_MAX - 1)} b`);
    expect(long.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(long.endsWith("-")).toBe(false);
  });

  it("returns an empty string when nothing survives", () => {
    expect(deriveSlug("!!!")).toBe("");
  });
});

describe("validateSlug", () => {
  it("accepts DNS-label style slugs", () => {
    expect(validateSlug("vertex-freight")).toBeNull();
    expect(validateSlug("a1b")).toBeNull();
    expect(SlugSchema.safeParse("vertex-freight").success).toBe(true);
  });

  it("explains each failure", () => {
    expect(validateSlug("")).toBe("enter a slug");
    expect(validateSlug("ab")).toMatch(/at least 3/);
    expect(validateSlug("a".repeat(SLUG_MAX + 1))).toMatch(/at most/);
    expect(validateSlug("Acme Air")).toMatch(/lowercase/);
    expect(validateSlug("-acme")).toMatch(/start and end/);
    expect(validateSlug("new")).toBe("reserved");
    expect(SlugSchema.safeParse("new").success).toBe(false);
  });
});
