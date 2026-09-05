import { CardTitle } from "@/components/ui/card";
import { FactList } from "@/components/ui/well";
import { formatDuration, shortId, shortSnapshotKey } from "../lib";
import type { RunDetail } from "../schemas";

/**
 * "Run facts" panel from frame 09. actualHash turns amber when it differs
 * from specHash; the snapshot key is link-toned; the lock reads "held 3.4s"
 * once released and "held · in flight" while the worker still owns it.
 */
export function RunFacts({ run }: { run: RunDetail }) {
  const f = run.facts;
  const drifted = f.actualHash !== f.specHash;
  return (
    <section aria-labelledby="run-facts-title" className="flex flex-col gap-3 border-b border-line p-[18px]">
      <CardTitle id="run-facts-title">Run facts</CardTitle>
      <FactList
        labelWidth={104}
        items={[
          {
            label: "advisory lock",
            value: f.advisoryLockHeldMs === null ? "held · in flight" : `held ${formatDuration(f.advisoryLockHeldMs)}`,
            tone: f.advisoryLockHeldMs === null ? "text-link" : "text-ready",
          },
          { label: "outbox msg", value: f.outboxMessageId ? <span title={f.outboxMessageId}>{shortId(f.outboxMessageId)}</span> : "—" },
          { label: "worker", value: f.worker },
          {
            label: "snapshot",
            value: f.snapshotKey ? <span title={f.snapshotKey}>{shortSnapshotKey(f.snapshotKey)}</span> : "none · no changes",
            tone: f.snapshotKey ? "text-link" : "text-fg-meta",
          },
          { label: "specHash", value: <span title={f.specHash}>{shortId(f.specHash)}</span> },
          {
            label: "actualHash",
            value: <span title={f.actualHash}>{shortId(f.actualHash)}</span>,
            tone: drifted ? "text-degraded" : undefined,
          },
        ]}
      />
    </section>
  );
}
