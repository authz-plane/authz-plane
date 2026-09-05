"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  WINDOW_LABELS,
  WindowSchema,
  type Window,
} from "@/features/dashboard/schemas";

/**
 * Range selector styled as the 32px dropdown pill from frame 02. The value
 * lives in the URL so the view is shareable and the server prefetch agrees
 * with the client query key.
 */
export function WindowSelect({ value }: { value: Window }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <label className="relative inline-flex h-8 items-center rounded-control border border-line-control text-[12.5px] text-fg-secondary transition-colors duration-[120ms] hover:border-line-disabled hover:text-fg focus-within:border-line-focus">
      <span className="sr-only">Time window</span>
      <select
        value={value}
        onChange={(e) => {
          const next = WindowSchema.parse(e.target.value);
          const params = new URLSearchParams();
          if (next !== "24h") params.set("window", next);
          const qs = params.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname);
        }}
        className="h-full cursor-pointer appearance-none bg-transparent pl-3 pr-7 text-inherit outline-none"
      >
        {WindowSchema.options.map((w) => (
          <option key={w} value={w} className="bg-elevated text-fg">
            {WINDOW_LABELS[w]}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 font-mono text-fg-meta"
      >
        ▾
      </span>
    </label>
  );
}
