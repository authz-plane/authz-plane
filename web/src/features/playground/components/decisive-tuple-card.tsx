import Link from "next/link";
import { FactList } from "@/components/ui/well";
import type { ExplainResponse } from "@/features/playground/schemas";

/**
 * The product differentiator (frame 15): every explain result names the
 * tuple, its author, and links to its audit event. Denied results get the
 * same card in the failed tone with the plain-language reason and no
 * provenance, because there is nothing to attribute.
 */

/** "a3f1d2e4b6c9" -> "a3f1…c9" */
export function shortTupleId(id: string): string {
  return id.length <= 8 ? id : `${id.slice(0, 4)}…${id.slice(-2)}`;
}

export function auditEventHref(slug: string, eventId: string): string {
  return `/tenants/${slug}/audit-events?event=${encodeURIComponent(eventId)}`;
}

export function DecisiveTupleCard({ slug, result }: { slug: string; result: ExplainResponse }) {
  const d = result.decisive;
  if (!result.allowed || !d) {
    return (
      <section
        aria-label="Decision"
        className="flex items-center gap-5 rounded-card border border-failed-border-strong bg-failed-tint-deep p-4"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold text-failed">Denied · no tuple grants this</span>
          <p className="text-[12.5px] leading-[1.55] text-fg-secondary">{result.reason}</p>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-label="Decisive tuple"
      className="flex items-center gap-5 rounded-card border border-ready-border-strong bg-ready-tint-deep p-4"
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold text-ready">Allowed because of one tuple</span>
        <p className="text-[12.5px] leading-[1.55] text-fg-secondary">{result.reason}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-l border-ready-border pl-5">
        <FactList
          labelWidth={76}
          items={[
            { label: "tupleId", value: <span title={d.tupleId}>{shortTupleId(d.tupleId)}</span> },
            { label: "writtenBy", value: d.writtenBy },
            { label: "writtenAt", value: d.writtenAt },
          ]}
        />
        <Link href={auditEventHref(slug, d.auditEventId)} className="font-mono text-[11.5px] text-link">
          open audit event ↗
        </Link>
      </div>
    </section>
  );
}
