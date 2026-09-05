import { describe, expect, it } from "vitest";
import { compactAge, retryCountdownText, spanLabel } from "./countdown";

const NOW = Date.parse("2026-09-04T10:15:00Z");

describe("retryCountdownText", () => {
  it("counts down from nextAttemptAt", () => {
    expect(retryCountdownText("2026-09-04T10:15:45Z", NOW)).toBe("next retry in 45s");
    expect(retryCountdownText("2026-09-04T10:15:45Z", NOW + 30_000)).toBe("next retry in 15s");
    expect(retryCountdownText("2026-09-04T10:15:45Z", NOW + 44_200)).toBe("next retry in 1s");
  });

  it("switches to 'retrying now' once the instant passes", () => {
    expect(retryCountdownText("2026-09-04T10:15:45Z", NOW + 45_000)).toBe("retrying now");
    expect(retryCountdownText("2026-09-04T10:15:45Z", NOW + 90_000)).toBe("retrying now");
  });

  it("formats minutes and handles the terminal case", () => {
    expect(retryCountdownText("2026-09-04T10:17:05Z", NOW)).toBe("next retry in 2m 05s");
    expect(retryCountdownText(null, NOW)).toBe("no retry scheduled");
    expect(retryCountdownText("not a date", NOW)).toBe("no retry scheduled");
  });
});

describe("compactAge / spanLabel", () => {
  it("prints the compact ages the Recent runs list shows", () => {
    expect(compactAge("2026-09-04T10:14:15Z", NOW)).toBe("45s");
    expect(compactAge("2026-09-04T10:04:00Z", NOW)).toBe("11m");
    expect(compactAge("2026-09-04T08:15:00Z", NOW)).toBe("2h");
    expect(compactAge("2026-09-01T10:15:00Z", NOW)).toBe("3d");
  });

  it("labels the exhausted-attempts span", () => {
    expect(spanLabel(1440)).toBe("24m");
    expect(spanLabel(4320)).toBe("1h 12m");
    expect(spanLabel(7200)).toBe("2h");
  });
});
