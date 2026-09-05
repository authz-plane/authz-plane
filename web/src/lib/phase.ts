import type { Phase } from "@/features/tenants/schemas";

/**
 * Phase language from the handoff "Color — semantic" table. Each entry maps a
 * meaning to the Tailwind classes that carry it, so a chip, a tinted card and a
 * bar segment for the same phase always agree. Never encode state in colour
 * alone: every consumer also renders the phase word or a glyph.
 */
export type Tone =
  | "neutral"
  | "link"
  | "ready"
  | "degraded"
  | "failed"
  | "drift";

export interface ToneClasses {
  /** foreground / text colour */
  fg: string;
  /** chip background */
  chipBg: string;
  /** border for tinted cards */
  border: string;
  /** background for tinted cards */
  tint: string;
  /** fill for bars and dots */
  fill: string;
}

export const TONES: Record<Tone, ToneClasses> = {
  neutral: {
    fg: "text-fg-secondary",
    chipBg: "bg-selected",
    border: "border-line",
    tint: "bg-transparent",
    fill: "bg-line-control",
  },
  link: {
    fg: "text-link",
    chipBg: "bg-link-chip",
    border: "border-link-border",
    tint: "bg-link-tint",
    fill: "bg-link",
  },
  ready: {
    fg: "text-ready",
    chipBg: "bg-ready-chip",
    border: "border-ready-border",
    tint: "bg-ready-tint",
    fill: "bg-ready",
  },
  degraded: {
    fg: "text-degraded",
    chipBg: "bg-degraded-chip",
    border: "border-degraded-border",
    tint: "bg-degraded-tint",
    fill: "bg-degraded",
  },
  failed: {
    fg: "text-failed",
    chipBg: "bg-failed-chip",
    border: "border-failed-card-border",
    tint: "bg-failed-card-tint",
    fill: "bg-failed",
  },
  drift: {
    fg: "text-drift",
    chipBg: "bg-drift-chip",
    border: "border-drift-border",
    tint: "bg-drift-tint",
    fill: "bg-drift",
  },
};

export function toneForPhase(phase: Phase): Tone {
  switch (phase) {
    case "Ready":
      return "ready";
    case "Degraded":
      return "degraded";
    case "Failed":
      return "failed";
    case "Pending":
    case "Planning":
    case "Applying":
    case "Deleting":
      return "link";
  }
}

/** Phases during which screens 02/03/04/08/09 poll at the fast interval. */
export const IN_FLIGHT_PHASES: readonly Phase[] = [
  "Planning",
  "Applying",
  "Deleting",
];
