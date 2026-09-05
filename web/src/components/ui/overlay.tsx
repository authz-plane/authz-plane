"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Modal (1080×780, bg/elevated, border #262E3A, shadow 0 40px 90px) and
 * Drawer (640px right, shadow -30px 0 70px). Both trap focus, close on Esc
 * and on scrim click, and are route-addressable by the caller.
 */
function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const node = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);
  return ref;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(4,6,9,0.72)]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex max-h-[calc(100vh-40px)] w-[1080px] max-w-[calc(100vw-40px)] flex-col overflow-hidden rounded-frame border border-line-modal bg-elevated shadow-[0_40px_90px_rgba(0,0,0,.55)]",
          className,
        )}
        style={{ height: 780 }}
      >
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useFocusTrap(open, onClose);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[rgba(4,6,9,0.6)]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex h-full w-[640px] max-w-full flex-col overflow-hidden border-l border-line-modal bg-elevated shadow-[-30px_0_70px_rgba(0,0,0,.5)]",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Standard header for either overlay: title block left, ✕ right. */
export function OverlayHeader({
  title,
  meta,
  onClose,
  chip,
}: {
  title: ReactNode;
  meta?: ReactNode;
  onClose: () => void;
  chip?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
      <div className="flex min-w-0 flex-col gap-1.5">
        {chip}
        <h2 className="text-[17px] font-semibold leading-tight text-fg">{title}</h2>
        {meta && <div className="font-mono text-[11px] text-fg-meta">{meta}</div>}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="rounded-control px-2 py-1 font-mono text-[14px] text-fg-meta transition-colors duration-[120ms] hover:bg-hover hover:text-fg"
      >
        ✕
      </button>
    </div>
  );
}

export function OverlayFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-t border-line bg-inset px-6 py-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
