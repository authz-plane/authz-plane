import type { Tone } from "@/lib/phase";
import {
  type ChangeOutcome,
  type LogLevel,
  type Outcome,
  type PhaseTone,
  type RunSummary,
} from "./schemas";

/**
 * Pure helpers shared by the list and the detail. Everything here is
 * deterministic across server and client so hydration never disagrees.
 */

/** `8f1c9e4b27d2` -> `8f1c…d2`, as every frame abbreviates ids and hashes. */
export function shortId(id: string): string {
  if (id.length <= 6) return id;
  return `${id.slice(0, 4)}…${id.slice(-2)}`;
}

/** 640 -> "640ms"; 3400 -> "3.4s"; 6000 -> "6.0s". */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Always milliseconds: the change rows show "3000ms" next to "92ms". */
export function formatMillis(ms: number | null): string {
  return ms === null ? "—" : `${Math.round(ms)}ms`;
}

/** "10:14:22" (worker log) or "10:14:22Z" (header meta). Fixed UTC zone. */
export function utcSeconds(iso: string, suffix = false): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}${suffix ? "Z" : ""}`;
}

export const OUTCOME_TONE: Record<Outcome, Tone> = {
  Partial: "degraded",
  Drift: "drift",
  Applying: "link",
  NoChanges: "ready",
  Failed: "failed",
  Applied: "ready",
  Deleting: "link",
};

/** Runs the worker still holds; the list polls fast while any is present. */
export const IN_FLIGHT_OUTCOMES: readonly Outcome[] = ["Applying", "Deleting"];

export function isInFlight(run: Pick<RunSummary, "outcome" | "finishedAt">): boolean {
  return run.finishedAt === null || IN_FLIGHT_OUTCOMES.includes(run.outcome);
}

export const FAST_POLL_MS = 2_000;
export const SLOW_POLL_MS = 10_000;
export const LIVE_POLL_MS = 1_000;

/** Handoff "Live state": 2s while anything is Applying/Deleting, 10s otherwise. */
export function pollIntervalForRuns(runs: ReadonlyArray<Pick<RunSummary, "outcome" | "finishedAt">> | undefined): number {
  if (!runs) return SLOW_POLL_MS;
  return runs.some(isInFlight) ? FAST_POLL_MS : SLOW_POLL_MS;
}

/** Detail polls at 1s until finishedAt is set, then stops (`false`). */
export function detailPollInterval(run: Pick<RunSummary, "finishedAt"> | undefined): number | false {
  if (!run) return false;
  return run.finishedAt === null ? LIVE_POLL_MS : false;
}

export const CHANGE_TONE: Record<ChangeOutcome, Tone> = {
  applied: "ready",
  failed: "failed",
  retrying: "degraded",
  applying: "link",
  pending: "neutral",
  skipped: "neutral",
};

export const CHANGE_GLYPH: Record<ChangeOutcome, string> = {
  applied: "✓",
  failed: "✕",
  retrying: "⚠",
  applying: "→",
  pending: "·",
  skipped: "·",
};

export interface ChangeSegment {
  tone: Tone;
  outcome: ChangeOutcome | "drift";
}

export type ChangesCell =
  | { kind: "text"; text: string; tone: Tone }
  | { kind: "segments"; segments: ChangeSegment[]; caption: string; captionTone: Tone; label: string };

/**
 * Builds the CHANGES column: one 24×5px segment per change coloured by its
 * outcome, with a caption that spells the state out so colour is never alone.
 * "no changes" runs render text only; drift runs render one segment per
 * finding; backoff attempts caption the attempt counter.
 */
export function changesCell(run: RunSummary): ChangesCell {
  if (run.outcome === "Drift") {
    const n = run.driftCount;
    return {
      kind: "segments",
      segments: Array.from({ length: n }, () => ({ tone: "drift", outcome: "drift" })),
      caption: `${n} drift`,
      captionTone: "drift",
      label: `${n} drift finding${n === 1 ? "" : "s"}`,
    };
  }
  if (run.changeOutcomes.length === 0) {
    return { kind: "text", text: "no changes", tone: "neutral" };
  }
  const segments = run.changeOutcomes.map<ChangeSegment>((o) => ({ tone: CHANGE_TONE[o], outcome: o }));
  const applied = run.changeOutcomes.filter((o) => o === "applied").length;
  const failed = run.changeOutcomes.filter((o) => o === "failed").length;
  const total = run.changeOutcomes.length;
  const summary = `${applied} of ${total} changes applied${failed ? `, ${failed} failed` : ""}`;

  if (run.outcome === "Failed" && run.attempt) {
    return {
      kind: "segments",
      segments,
      caption: `attempt ${run.attempt.n}/${run.attempt.max}`,
      captionTone: "failed",
      label: `${summary} · attempt ${run.attempt.n} of ${run.attempt.max}`,
    };
  }
  if (run.outcome === "Deleting") {
    return { kind: "segments", segments, caption: "finalizers", captionTone: "neutral", label: `${summary} · finalizers running` };
  }
  return { kind: "segments", segments, caption: `${applied}/${total}`, captionTone: "neutral", label: summary };
}

export const PHASE_TONE_FILL: Record<PhaseTone, string> = {
  ready: "bg-ready",
  link: "bg-link",
  degraded: "bg-degraded",
  failed: "bg-failed",
  drift: "bg-drift",
  neutral: "bg-line-control",
};

export const PHASE_TONE_TEXT: Record<PhaseTone, string> = {
  ready: "text-fg-secondary",
  link: "text-fg-secondary",
  degraded: "text-degraded",
  failed: "text-failed",
  drift: "text-drift",
  neutral: "text-fg-secondary",
};

/** Worker-log timestamps colour by level; the text stays tertiary. */
export const LOG_TS_TONE: Record<LogLevel, string> = {
  info: "text-fg-meta",
  ready: "text-ready",
  link: "text-link",
  degraded: "text-degraded",
  failed: "text-failed",
};

/** `r2://snapshots/acme-air/8f1c9e4b27d2.json` -> `r2://…/8f1c.json`, as the facts panel abbreviates it. */
export function shortSnapshotKey(key: string): string {
  const m = /^([a-z0-9]+:\/\/).*\/([0-9a-f]{12})\.json$/.exec(key);
  if (!m) return key;
  return `${m[1]}…/${m[2]!.slice(0, 4)}.json`;
}

/** Filename for the pre-apply snapshot download. */
export function snapshotFilename(runId: string): string {
  return `pre-apply-${runId}.json`;
}
