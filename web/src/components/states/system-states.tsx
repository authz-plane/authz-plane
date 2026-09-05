import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Skeleton } from "@/components/ui/skeleton";
import { Well, WellLine } from "@/components/ui/well";
import { cn } from "@/lib/cn";

/**
 * Screen 20: the four shared system states. Every table and page uses these
 * rather than inventing its own. Skeletons, never spinners.
 */

/** Quadrant 1. Dashed #2E3A55 tile with "+", 16px title, explainer, actions. */
export function EmptyState({
  eyebrow,
  title,
  children,
  actions,
  glyph = "+",
  className,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  glyph?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-4 p-8", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <div
        aria-hidden
        className="flex size-[52px] items-center justify-center rounded-tile border border-dashed border-line-focus font-mono text-[22px] text-link"
      >
        {glyph}
      </div>
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      {children && <div className="max-w-[440px] text-[13px] leading-[1.6] text-fg-secondary">{children}</div>}
      {actions && <div className="flex items-center gap-2.5 pt-1">{actions}</div>}
    </div>
  );
}

/** Quadrant 2. Staggered 11px bars. Pass row count for tables. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  const widths = [150, 190, 120, 170, 74, 60, 88, 52];
  return (
    <div aria-busy aria-label="Loading" className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line-row px-4 py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className="h-[11px]"
              style={{ width: widths[(r + c) % widths.length], flex: c === columns - 1 ? 1 : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3, height = 64 }: { count?: number; height?: number }) {
  return (
    <div aria-busy className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4" style={{ height }}>
          <Skeleton className="h-[11px] w-[92px]" />
          <Skeleton className="h-[11px] w-[140px]" />
        </Card>
      ))}
    </div>
  );
}

/** Quadrant 3. Red card for a terminal failure that needs a human. */
export function TerminalFailure({
  title,
  summary,
  errorLines,
  actions,
  note = "Failed is terminal by design. A control plane that retries forever hides broken intent.",
  className,
}: {
  title: string;
  summary: ReactNode;
  errorLines: string[];
  actions: ReactNode;
  note?: string;
  className?: string;
}) {
  return (
    <Card
      role="alert"
      className={cn("flex flex-col gap-3.5 border-failed-border-strong bg-failed-tint-deep p-[18px]", className)}
    >
      <Eyebrow className="text-failed">Terminal failure · needs a human</Eyebrow>
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      <p className="text-[13px] leading-[1.6] text-fg-secondary">{summary}</p>
      <Well className="text-failed">
        {errorLines.map((l, i) => (
          <WellLine key={i}>{l}</WellLine>
        ))}
      </Well>
      <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
      <p className="text-[12px] leading-[1.5] text-fg-meta">{note}</p>
    </Card>
  );
}

/** Quadrant 4. Cross-tenant access denied. Reveals nothing about the other tenant. */
export function Forbidden({
  sessionTenant,
  deniedCheck,
  requestId,
  className,
}: {
  sessionTenant: string;
  deniedCheck: string;
  requestId: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-start gap-4 p-8", className)}>
      <Eyebrow>Forbidden · cross-tenant access denied</Eyebrow>
      <div
        aria-hidden
        className="flex size-[52px] items-center justify-center rounded-tile bg-[#1B1015] font-mono text-[22px] text-failed"
      >
        ⦸
      </div>
      <h2 className="text-[16px] font-semibold text-fg">You cannot see this tenant</h2>
      <p className="max-w-[440px] text-[13px] leading-[1.6] text-fg-secondary">
        Your session is scoped to <span className="font-mono text-fg">{sessionTenant}</span>. The check{" "}
        <span className="font-mono text-fg">{deniedCheck}</span> was denied. Whether the other tenant exists is not
        disclosed.
      </p>
      <Well className="w-full max-w-[440px] text-[11.5px]">
        <WellLine>{`{ "type": "https://authz-plane.dev/problems/forbidden",`}</WellLine>
        <WellLine indent={1}>{`"status": 403, "title": "Forbidden",`}</WellLine>
        <WellLine indent={1}>{`"requestId": "${requestId}" }`}</WellLine>
        <WellLine className="text-fg-meta">this attempt was audited</WellLine>
      </Well>
      <LinkButton href="/tenants" variant="secondary" size="md">
        Back to my tenants
      </LinkButton>
    </div>
  );
}

/** Inline problem+json rendering (title + detail) in the tinted well pattern. */
export function ProblemNotice({
  title,
  detail,
  onRetry,
  className,
}: {
  title: string;
  detail?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex items-start justify-between gap-4 rounded-inner border border-failed-border bg-failed-tint p-4", className)}
    >
      <div className="flex flex-col gap-1">
        <div className="text-[13px] font-semibold text-failed">{title}</div>
        {detail && <div className="font-mono text-[11.5px] text-fg-secondary">{detail}</div>}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-control border border-line-control px-3 py-1 text-[12px] text-fg-secondary hover:border-line-disabled hover:text-fg"
        >
          Retry
        </button>
      )}
    </div>
  );
}
