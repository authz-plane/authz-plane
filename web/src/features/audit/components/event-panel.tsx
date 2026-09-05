"use client";

import { useEffect, useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DiffBlock } from "@/components/ui/diff";
import { Eyebrow } from "@/components/ui/eyebrow";
import { FactList } from "@/components/ui/well";
import { ACTION_TONE, eventJson, shortId, utcTime } from "../format";
import type { AuditEvent } from "../schemas";

/**
 * Frame 17's right 400px panel: action chip, title, actor/time; BEFORE /
 * AFTER tinted diff; CONTEXT facts (requestId, traceId + open ↗, ip,
 * idempotencyKey, specHash); the redaction note; Copy JSON / Show related run.
 */
export function EventPanel({ event }: { event: AuditEvent | undefined }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  if (!event) {
    return (
      <div className="flex flex-col gap-2 p-[18px]">
        <Eyebrow>Event</Eyebrow>
        <p className="text-[12.5px] text-fg-secondary">Select a row to see its before / after and request context.</p>
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(eventJson(event));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" aria-label={`Event ${event.id}`} role="region">
      <div className="flex flex-col gap-1.5 border-b border-line p-[18px]">
        <Chip tone={ACTION_TONE[event.action]} className="self-start text-[11px]">
          {event.action}
        </Chip>
        <h2 className="text-[15px] font-semibold leading-tight text-fg">{event.title}</h2>
        <span className="font-mono text-[11.5px] text-fg-meta">
          {event.actor.label} · {event.actor.kind} · <time dateTime={event.occurredAt}>{utcTime(event.occurredAt, true)}</time>
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-[18px]">
        <section className="flex flex-col gap-2" aria-labelledby={`audit-diff-${event.id}`}>
          <Eyebrow id={`audit-diff-${event.id}`}>Before / after</Eyebrow>
          <DiffBlock lines={event.diff} dimContext className="py-0 text-[11.5px] [&>div]:py-[6px]" />
        </section>

        <section className="flex flex-col gap-2" aria-labelledby={`audit-context-${event.id}`}>
          <Eyebrow id={`audit-context-${event.id}`}>Context</Eyebrow>
          <FactList
            labelWidth={110}
            className="text-fg-secondary"
            items={[
              { label: "requestId", value: <span title={event.requestId}>{shortId(event.requestId)}</span> },
              {
                label: "traceId",
                value: event.traceId ? (
                  <span className="inline-flex items-center gap-2">
                    <span title={event.traceId}>{shortId(event.traceId, 8, 2)}</span>
                    {/* Fictional trace backend; the real link comes from the API's `traceUrl`. */}
                    <a
                      href={`https://traces.authz-plane.test/trace/${encodeURIComponent(event.traceId)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-link"
                    >
                      open <span aria-hidden>↗</span>
                    </a>
                  </span>
                ) : (
                  <span className="text-fg-meta">—</span>
                ),
              },
              { label: "ip", value: event.ip ?? <span className="text-fg-meta">— (system)</span> },
              {
                label: "idempotencyKey",
                value: event.idempotencyKey ? (
                  <span title={event.idempotencyKey}>{shortId(event.idempotencyKey)}</span>
                ) : (
                  <span className="text-fg-meta">—</span>
                ),
              },
              { label: "specHash", value: event.specHash ?? <span className="text-fg-meta">—</span> },
            ]}
          />
        </section>

        <div
          role="note"
          className="flex gap-[9px] rounded-inner border border-degraded-border bg-degraded-tint p-[13px] text-[12px] leading-[1.55] text-fg-secondary"
        >
          <span aria-hidden className="font-mono text-degraded">
            ⚠
          </span>
          <p>Secret values are redacted before persistence. Only the fact of rotation is recorded.</p>
        </div>

        <div className="mt-auto flex gap-2 pt-2">
          <Button variant="outline" size="md" className="h-9 flex-1 rounded-[8px] text-[12.5px]" onClick={copy}>
            {copied ? "Copied ✓" : "Copy JSON"}
          </Button>
          {event.relatedRunId ? (
            <LinkButton
              href={`/reconcile-runs/${encodeURIComponent(event.relatedRunId)}`}
              variant="outline"
              size="md"
              className="h-9 flex-1 rounded-[8px] text-[12.5px]"
            >
              Show related run
            </LinkButton>
          ) : (
            <Button variant="outline" size="md" className="h-9 flex-1 rounded-[8px] text-[12.5px]" disabled>
              No related run
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
