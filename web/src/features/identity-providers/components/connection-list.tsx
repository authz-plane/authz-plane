import Link from "next/link";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/phase";
import { SSRF_POLICY } from "../probe";
import { IDP_STATE_LABEL, type IdentityProvider, type IdpState } from "../schemas";

const STATE_TONE: Record<IdpState, Tone> = {
  pending_apply: "degraded",
  applied: "ready",
  disabled: "neutral",
};

/**
 * Left 420px column of frame 16: "Connections" + "+ Add", one card per
 * connection (selection is route-addressable via ?idp=), and the SSRF-guard
 * policy pinned to the bottom. Disabled connections dim but keep their word.
 */
export function ConnectionList({ slug, items, selectedId }: { slug: string; items: IdentityProvider[]; selectedId: string | null }) {
  const base = `/tenants/${encodeURIComponent(slug)}/identity-providers`;
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-line px-5">
        <h1 className="text-[15px] font-semibold text-fg">Connections</h1>
        {/* Adding a connection is a spec edit; the editor owns creation until the API grows a POST. */}
        <Link href={`/tenants/${encodeURIComponent(slug)}/spec`} className="font-mono text-[12px] text-link" title="add a connection in the spec editor">
          + Add
        </Link>
      </div>
      <nav aria-label="Connections" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-auto p-3.5">
        {items.length === 0 && <p className="px-1 font-mono text-[11px] text-fg-meta">no connections in this spec</p>}
        {items.map((idp) => {
          const selected = idp.id === selectedId;
          const disabled = idp.state === "disabled";
          return (
            <Link
              key={idp.id}
              href={`${base}?idp=${encodeURIComponent(idp.id)}`}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex flex-col gap-2 rounded-card border p-3.5 text-fg transition-colors duration-[120ms]",
                selected ? "border-line-focus bg-link-tint" : "border-line hover:border-line-control hover:bg-hover",
                disabled && !selected && "opacity-70",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <span className={cn("truncate text-[13.5px] font-semibold", disabled ? "text-fg-secondary" : "text-fg")}>{idp.name}</span>
                <Chip tone={STATE_TONE[idp.state]} className={idp.state === "disabled" ? "text-fg-tertiary" : undefined}>
                  {IDP_STATE_LABEL[idp.state]}
                </Chip>
              </div>
              <span className="truncate font-mono text-[11.5px] text-fg-meta">{idp.note ?? `${idp.kind} · ${idp.host}`}</span>
              {idp.state !== "disabled" && (
                <div className="flex gap-3.5 font-mono text-[11px] text-fg-tertiary">
                  <span>{idp.userCount} users</span>
                  {idp.externalId && (
                    <>
                      <span aria-hidden>·</span>
                      <span>ext {idp.externalId}</span>
                    </>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-line p-4">
        <Eyebrow>SSRF guard</Eyebrow>
        <p className="font-mono text-[11px] leading-[1.75] text-fg-tertiary">{SSRF_POLICY}</p>
      </div>
    </aside>
  );
}
