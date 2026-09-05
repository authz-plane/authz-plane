"use client";

import { cn } from "@/lib/cn";
import { shortHash, type SpecVersion } from "../schemas";

/** "2026-09-03 10:02" in UTC, as frame 06 prints it. Fixed zone so SSR and the browser agree. */
export function utcMinute(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * Frame 06's left column (320px): one card per generation. The current
 * generation is blue with badge B; the compare base carries badge A and the
 * focus-blue border. Clicking a card makes it side A (or B when it is newer
 * than the current B) so the pair always reads older → newer.
 */
export function VersionList({
  versions,
  a,
  b,
  onSelect,
}: {
  versions: SpecVersion[];
  a: number;
  b: number;
  onSelect: (generation: number) => void;
}) {
  return (
    <ol className="flex flex-col gap-2 p-2.5" aria-label="versions">
      {versions.map((v) => {
        const isA = v.generation === a;
        const isB = v.generation === b;
        const current = v.status === "current";
        return (
          <li key={v.generation}>
            <button
              type="button"
              onClick={() => onSelect(v.generation)}
              aria-pressed={isA || isB}
              aria-label={`gen ${v.generation}${isA ? " · side A" : isB ? " · side B" : ""}`}
              className={cn(
                "flex w-full flex-col gap-1.5 rounded-inner border p-3 text-left transition-colors duration-[120ms]",
                isB ? "border-line-control bg-hover" : isA ? "border-line-focus bg-link-tint" : "border-line hover:border-line-control hover:bg-hover",
              )}
            >
              <span className="flex items-center justify-between">
                <span className={cn("font-mono text-[12.5px]", current ? "text-link" : "text-fg")}>
                  gen {v.generation}
                  {current && " · current"}
                </span>
                {(isA || isB) && (
                  // link-chip-alt is frame 06's A-badge chip; one shade off link-chip.
                  <span className={cn("rounded-[4px] px-1.5 py-[2px] font-mono text-[10.5px] text-link", isB ? "bg-link-chip" : "bg-link-chip-alt")}>{isB ? "B" : "A"}</span>
                )}
              </span>
              <span className="text-[12px] text-fg-secondary">
                {v.author} · {utcMinute(v.createdAt)}
              </span>
              <span className="font-mono text-[11px] text-fg-meta">
                {shortHash(v.hash)} · {v.summary}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
