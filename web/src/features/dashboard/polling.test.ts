import { describe, expect, it } from "vitest";
import { FAST_POLL_MS, pollIntervalFor, SLOW_POLL_MS } from "./polling";

describe("pollIntervalFor", () => {
  it("polls fast while any tenant is planning, applying or deleting", () => {
    expect(pollIntervalFor({ Ready: 40, Applying: 1 })).toBe(FAST_POLL_MS);
    expect(pollIntervalFor({ Planning: 2 })).toBe(FAST_POLL_MS);
    expect(pollIntervalFor({ Deleting: 1 })).toBe(FAST_POLL_MS);
  });

  it("backs off when everything is settled, including degraded and failed", () => {
    expect(pollIntervalFor({ Ready: 38, Degraded: 2, Failed: 1 })).toBe(
      SLOW_POLL_MS,
    );
    expect(pollIntervalFor({ Applying: 0, Ready: 1 })).toBe(SLOW_POLL_MS);
  });

  it("backs off when no data has arrived yet", () => {
    expect(pollIntervalFor(undefined)).toBe(SLOW_POLL_MS);
  });
});
