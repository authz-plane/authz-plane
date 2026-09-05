import Link from "next/link";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { TONES, type Tone } from "@/lib/phase";
import type { AttentionItem, AttentionKind } from "@/features/dashboard/schemas";

const KIND_TONE: Record<AttentionKind, Tone> = {
  failed: "failed",
  degraded: "degraded",
  drift: "drift",
  applying: "link",
};

/** Phase-tinted card: mono slug + chip on one line, one-line reason beneath. */
function AttentionCard({ item }: { item: AttentionItem }) {
  const tone = KIND_TONE[item.kind];
  const t = TONES[tone];
  // Applying is the neutral card in the reference: plain border, no tint.
  const tinted = item.kind !== "applying";
  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          "flex flex-col gap-1.5 rounded-[8px] border p-3 text-fg transition-colors duration-[120ms] hover:text-fg",
          tinted ? cn(t.border, t.tint) : "border-line hover:bg-hover",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[12.5px]">{item.slug}</span>
          <Chip tone={tone}>{item.label}</Chip>
        </div>
        <span className="text-[12px] leading-[1.5] text-fg-secondary">
          {item.reason}
        </span>
      </Link>
    </li>
  );
}

export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  return (
    <Card className="flex min-h-0 flex-col gap-3.5 p-[18px]">
      <CardTitle>Needs attention</CardTitle>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-fg-secondary">
          Nothing needs attention. Every tenant is converged and no drift is
          open.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 overflow-hidden">
          {items.map((item) => (
            <AttentionCard key={`${item.kind}:${item.slug}`} item={item} />
          ))}
        </ul>
      )}
    </Card>
  );
}
