import { describe, expect, it } from "vitest";
import { FIXTURE_NOW, RUN_IDS, reconcileRunFixtures } from "./fixtures";
import {
  changesCell,
  detailPollInterval,
  FAST_POLL_MS,
  formatDuration,
  formatMillis,
  LIVE_POLL_MS,
  pollIntervalForRuns,
  shortId,
  shortSnapshotKey,
  SLOW_POLL_MS,
  utcSeconds,
} from "./lib";
import type { RunSummary } from "./schemas";

const runs = reconcileRunFixtures(new Date(FIXTURE_NOW));
const byId = (id: string) => runs.find((r) => r.id === id)!;

describe("formatting", () => {
  it("abbreviates ids and hashes the way the frames do", () => {
    expect(shortId("8f1c9e4b27d2")).toBe("8f1c…d2");
    expect(shortId("4bf9e2c7d81a03b6f5a1")).toBe("4bf9…a1");
    expect(shortId("abc")).toBe("abc");
  });

  it("formats durations in ms below a second and one decimal above", () => {
    expect(formatDuration(180)).toBe("180ms");
    expect(formatDuration(640)).toBe("640ms");
    expect(formatDuration(1100)).toBe("1.1s");
    expect(formatDuration(3400)).toBe("3.4s");
    expect(formatDuration(6000)).toBe("6.0s");
  });

  it("keeps change durations in milliseconds and dashes the absent ones", () => {
    expect(formatMillis(3000)).toBe("3000ms");
    expect(formatMillis(92)).toBe("92ms");
    expect(formatMillis(null)).toBe("—");
  });

  it("renders UTC seconds with an optional zone suffix", () => {
    expect(utcSeconds("2026-09-04T10:14:22.000Z")).toBe("10:14:22");
    expect(utcSeconds("2026-09-04T10:14:22.000Z", true)).toBe("10:14:22Z");
  });

  it("abbreviates snapshot keys", () => {
    expect(shortSnapshotKey("r2://snapshots/acme-air/8f1c9e4b27d2.json")).toBe("r2://…/8f1c.json");
    expect(shortSnapshotKey("weird")).toBe("weird");
  });
});

describe("changesCell", () => {
  it("builds one segment per change with a fraction caption", () => {
    const cell = changesCell(byId(RUN_IDS.acmePartial));
    expect(cell.kind).toBe("segments");
    if (cell.kind !== "segments") return;
    expect(cell.segments.map((s) => s.tone)).toEqual(["ready", "ready", "ready", "failed", "neutral"]);
    expect(cell.caption).toBe("3/5");
    expect(cell.label).toBe("3 of 5 changes applied, 1 failed");
  });

  it("colours in-flight changes link and pending ones neutral", () => {
    const cell = changesCell(byId(RUN_IDS.initechLive));
    if (cell.kind !== "segments") throw new Error("expected segments");
    expect(cell.segments.map((s) => s.tone)).toEqual(["ready", "ready", "ready", "link", "neutral"]);
    expect(cell.caption).toBe("3/5");
  });

  it("renders drift runs as one drift segment per finding", () => {
    const cell = changesCell(byId(RUN_IDS.globexDrift));
    if (cell.kind !== "segments") throw new Error("expected segments");
    expect(cell.segments.length).toBe(4);
    expect(cell.segments.every((s) => s.tone === "drift")).toBe(true);
    expect(cell.caption).toBe("4 drift");
    expect(cell.captionTone).toBe("drift");
  });

  it("captions exhausted backoff runs with the attempt counter", () => {
    const cell = changesCell(byId(RUN_IDS.northwindExhausted));
    if (cell.kind !== "segments") throw new Error("expected segments");
    expect(cell.segments).toEqual([{ tone: "failed", outcome: "failed" }]);
    expect(cell.caption).toBe("attempt 8/8");
    expect(cell.captionTone).toBe("failed");
  });

  it("captions deleting runs with finalizers and no-change runs with text", () => {
    const del = changesCell(byId(RUN_IDS.wayneDeleting));
    expect(del.kind === "segments" && del.caption).toBe("finalizers");
    expect(changesCell(byId(RUN_IDS.acmeUsersResync))).toEqual({ kind: "text", text: "no changes", tone: "neutral" });
  });

  it("uses the degraded tone for retrying changes", () => {
    const run: RunSummary = { ...byId(RUN_IDS.acmePartial), changeOutcomes: ["applied", "retrying"] };
    const cell = changesCell(run);
    expect(cell.kind === "segments" && cell.segments[1]?.tone).toBe("degraded");
  });
});

describe("polling", () => {
  it("polls the list fast while any run is in flight and slow otherwise", () => {
    expect(pollIntervalForRuns(runs)).toBe(FAST_POLL_MS);
    expect(pollIntervalForRuns(runs.filter((r) => r.finishedAt !== null))).toBe(SLOW_POLL_MS);
    expect(pollIntervalForRuns(undefined)).toBe(SLOW_POLL_MS);
  });

  it("polls the detail at 1s until finishedAt is set, then stops", () => {
    expect(detailPollInterval(byId(RUN_IDS.initechLive))).toBe(LIVE_POLL_MS);
    expect(detailPollInterval(byId(RUN_IDS.acmePartial))).toBe(false);
    expect(detailPollInterval(undefined)).toBe(false);
  });
});
