"use client";

import { Chip } from "@/components/ui/chip";
import { Drawer, OverlayHeader } from "@/components/ui/overlay";
import type { Tone } from "@/lib/phase";
import { utcStamp } from "../format";
import type { ModelVersion } from "../schemas";

const STATE_TONE: Record<ModelVersion["state"], Tone> = {
  live: "ready",
  draft: "link",
  superseded: "neutral",
};

/** Simple drawer listing v1..vN with author and UTC time, newest first. */
export function VersionHistoryDrawer({
  open,
  onClose,
  versions,
}: {
  open: boolean;
  onClose: () => void;
  versions: ModelVersion[];
}) {
  const ordered = [...versions].sort((a, b) => b.version - a.version);
  return (
    <Drawer open={open} onClose={onClose} title="Model version history">
      <OverlayHeader
        title="Version history"
        meta={`${versions.length} versions · models are immutable, a new version supersedes`}
        onClose={onClose}
      />
      <ul className="flex flex-col gap-2 overflow-auto p-6">
        {ordered.map((v) => (
          <li key={v.version} className="flex flex-col gap-1.5 rounded-inner border border-line bg-card p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[13px] text-fg">v{v.version}</span>
              <Chip tone={STATE_TONE[v.state]}>{v.state}</Chip>
              <span className="ml-auto font-mono text-[11px] text-fg-meta">{utcStamp(v.createdAt)}</span>
            </div>
            <div className="font-mono text-[11.5px] text-fg-secondary">{v.author}</div>
            <div className="text-[12.5px] text-fg-secondary">{v.summary}</div>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}
