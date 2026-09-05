import { Button } from "@/components/ui/button";

/**
 * Frame 10's sticky 64px footer, shown only while rows are selected:
 * mono summary left, Acknowledge + purple "Heal selected" right.
 */
export function SelectionFooter({
  count,
  busy,
  onAcknowledge,
  onHeal,
}: {
  count: number;
  busy?: boolean;
  onAcknowledge: () => void;
  onHeal: () => void;
}) {
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label="Selection actions"
      className="sticky bottom-0 z-10 -mx-6 flex h-16 shrink-0 items-center justify-between border-t border-line bg-inset px-6"
    >
      <span className="font-mono text-[11.5px] text-fg-meta">
        {count} selected · healing enqueues one reconcile per tenant and closes findings on convergence
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onAcknowledge} disabled={busy}>
          Acknowledge
        </Button>
        <Button variant="drift" size="sm" onClick={onHeal} disabled={busy}>
          Heal selected
        </Button>
      </div>
    </div>
  );
}
