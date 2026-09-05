"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { tenantListHref } from "../filters";
import type { TenantListFilter } from "../schemas";

const DEBOUNCE_MS = 300;

/**
 * 260px topbar search from frame 03. Writes `q` into the URL (debounced) so
 * the server prefetch, the client query key and the share link all agree.
 * Changing the query resets the cursor.
 */
export function TenantSearch({ filter }: { filter: TenantListFilter }) {
  const router = useRouter();
  const [value, setValue] = useState(filter.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function schedule(next: string) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = next.trim();
      if (q === (filter.q ?? "")) return;
      router.replace(tenantListHref(filter, { q: q || undefined }));
    }, DEBOUNCE_MS);
  }

  return (
    <label className="relative flex h-8 w-[260px] items-center gap-2 rounded-control border border-line-control px-3 text-[12.5px] text-fg-meta transition-colors duration-[120ms] hover:border-line-disabled focus-within:border-line-focus focus-within:bg-input-focus-bg">
      <span aria-hidden className="font-mono">
        ⌕
      </span>
      <span className="sr-only">Search tenants</span>
      <input
        type="search"
        value={value}
        placeholder="Search slug, display name, org id"
        onChange={(e) => {
          setValue(e.target.value);
          schedule(e.target.value);
        }}
        className="h-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-meta"
      />
    </label>
  );
}
