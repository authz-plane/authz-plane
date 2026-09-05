import { CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { LOG_TS_TONE, utcSeconds } from "../lib";
import type { LogLine } from "../schemas";

/**
 * "Worker log" from frame 09: mono 11px, line-height 1.85, tertiary text with
 * the timestamp coloured by level. aria-live so a screen reader hears new
 * lines while a live run streams in.
 */
export function WorkerLog({ log, live }: { log: LogLine[]; live: boolean }) {
  return (
    <section aria-labelledby="worker-log-title" className="flex min-h-0 flex-1 flex-col gap-3 p-[18px]">
      <div className="flex items-baseline justify-between">
        <CardTitle id="worker-log-title">Worker log</CardTitle>
        {live && (
          <span className="font-mono text-[11px] text-link" role="status">
            live · polling 1s
          </span>
        )}
      </div>
      <ol
        aria-live={live ? "polite" : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-auto rounded-[8px] border border-line bg-inset p-3 font-mono text-[11px] leading-[1.85] text-fg-tertiary"
      >
        {log.map((l, i) => (
          <li key={`${l.ts}-${i}`} className="whitespace-pre">
            <span className={cn(LOG_TS_TONE[l.level])}>{utcSeconds(l.ts)}</span> {l.text}
          </li>
        ))}
        {live && (
          <li aria-hidden className="text-fg-meta">
            ▍
          </li>
        )}
      </ol>
    </section>
  );
}
