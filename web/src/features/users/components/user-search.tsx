"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";

/** Search row of frame 18. The term lives in ?q= so the view is shareable and the server does the filtering. */
export function UserSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);

  const apply = (term: string) => {
    const params = new URLSearchParams();
    const q = term.trim();
    if (q) params.set("q", q);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <form
      role="search"
      className="relative w-[300px]"
      onSubmit={(e) => {
        e.preventDefault();
        apply(value);
      }}
    >
      <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[12.5px] text-fg-meta">
        ⌕
      </span>
      <Input
        type="search"
        size="sm"
        aria-label="Search email or subject"
        placeholder="Search email or subject"
        className="h-8 pl-8 text-[12.5px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          if (value.trim() !== initial.trim()) apply(value);
        }}
        autoComplete="off"
        spellCheck={false}
      />
    </form>
  );
}
