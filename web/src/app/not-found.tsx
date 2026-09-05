import type { Metadata } from "next";
import { LinkButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Wordmark } from "@/components/ui/logo-mark";

export const metadata: Metadata = { title: "Not found" };

/**
 * Root 404 in the screen-20 "empty" pattern: dashed tile, 16px title,
 * explainer, primary action. Rendered statically, so it cannot read the
 * session; the proxy still gates the "back" link. Most sidebar targets land
 * here until their screens exist.
 */
export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col bg-app text-fg">
      <header className="flex h-[60px] shrink-0 items-center border-b border-line px-7">
        <Wordmark />
      </header>
      <div className="flex flex-1 items-center justify-center p-12">
        <div className="flex w-[420px] flex-col items-start gap-4">
          <Eyebrow>Not found · 404</Eyebrow>
          <div
            aria-hidden
            className="flex size-[52px] items-center justify-center rounded-tile border border-dashed border-line-focus font-mono text-[22px] text-link"
          >
            +
          </div>
          <h1 className="text-[16px] font-semibold text-fg">
            This screen is not here yet
          </h1>
          <p className="text-[13px] leading-[1.6] text-fg-secondary">
            The route exists in the handoff, but the console is being built in
            order: overview, tenants, tenant detail, then the playground. Head
            back to the overview meanwhile.
          </p>
          <LinkButton href="/dashboard" variant="primary" size="md">
            Back to overview
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
