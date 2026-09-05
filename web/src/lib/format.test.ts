import { describe, expect, it } from "vitest";
import { groupThousands, initialsOf, percent, utcClock } from "./format";

describe("initialsOf", () => {
  it("takes the first letter of the first two words, upper-cased", () => {
    expect(initialsOf("Platform Operator")).toBe("PO");
    expect(initialsOf("ana ruiz gómez")).toBe("AR");
  });
  it("copes with a single word and stray whitespace", () => {
    expect(initialsOf("  ci-bot ")).toBe("C");
    expect(initialsOf("")).toBe("");
  });
});

describe("percent", () => {
  it("formats a ratio with one decimal by default", () => {
    expect(percent(0.9921)).toBe("99.2%");
    expect(percent(1)).toBe("100.0%");
    expect(percent(0.71, 0)).toBe("71%");
  });
});

describe("groupThousands", () => {
  it("uses a space separator as the handoff writes 1 284", () => {
    expect(groupThousands(1284)).toBe("1 284");
    expect(groupThousands(2418)).toBe("2 418");
    expect(groupThousands(42)).toBe("42");
    expect(groupThousands(1_000_000)).toBe("1 000 000");
  });
});

describe("utcClock", () => {
  it("renders HH:mmZ in UTC regardless of host zone", () => {
    expect(utcClock("2026-09-04T10:15:00Z")).toBe("10:15Z");
    expect(utcClock("2026-09-04T23:05:00+02:00")).toBe("21:05Z");
    expect(utcClock("2026-09-04T00:00:00Z")).toBe("00:00Z");
  });
});
