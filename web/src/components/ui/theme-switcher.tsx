"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { applyTheme, THEME_LABELS, THEMES, type Theme } from "@/lib/theme";

/**
 * Three-way segmented control (System / Light / Dark) in the filter-pill
 * idiom: 28px, radius 6, active = bg/selected + fg. Switching applies the
 * theme immediately and writes the preference cookie; no reload, no fetch.
 * `initial` is the server's reading of that cookie so SSR and hydration agree.
 */
export function ThemeSwitcher({
  initial,
  className,
}: {
  initial: Theme;
  className?: string;
}) {
  const [theme, setTheme] = useState<Theme>(initial);

  function select(next: Theme) {
    setTheme(next);
    applyTheme(next);
  }

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        role="group"
        aria-label="Theme"
        className="inline-flex w-fit items-center gap-0.5 rounded-control border border-line-control bg-inset p-0.5"
      >
        {THEMES.map((t) => {
          const active = t === theme;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={active}
              onClick={() => select(t)}
              className={cn(
                "inline-flex h-7 items-center rounded-pill px-3 text-[12.5px] transition-colors duration-[120ms]",
                active
                  ? "bg-selected font-medium text-fg"
                  : "text-fg-tertiary hover:bg-hover hover:text-fg",
              )}
            >
              {THEME_LABELS[t].label}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] leading-[1.5] text-fg-secondary" aria-live="polite">
        {THEME_LABELS[theme].hint}
      </p>
    </div>
  );
}
