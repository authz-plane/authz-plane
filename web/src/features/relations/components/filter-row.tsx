"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button, LinkButton } from "@/components/ui/button";
import type { RelationsFilter } from "../schemas";

/** 34px mono input with a dim prefix label (frame 14's "user user:raj" pattern). */
function PrefixedInput({ name, defaultValue }: { name: keyof RelationsFilter; defaultValue?: string }) {
  return (
    <label className="flex h-[34px] flex-1 items-center gap-2 rounded-control border border-line-control px-3 font-mono text-[12px] transition-colors duration-150 hover:border-line-disabled focus-within:border-line-focus focus-within:bg-input-focus-bg">
      <span className="text-fg-meta">{name}</span>
      <input
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder="any"
        autoComplete="off"
        spellCheck={false}
        className="min-w-0 flex-1 bg-transparent text-fg-secondary outline-none placeholder:text-fg-meta"
      />
    </label>
  );
}

/**
 * Filters live in the URL so a view is shareable and the server prefetch
 * agrees with the client query key. Submit replaces the query string; the
 * page re-renders with the new filter.
 */
export function FilterRow({ filter }: { filter: RelationsFilter }) {
  const router = useRouter();
  const pathname = usePathname();
  const hasFilter = Boolean(filter.user || filter.relation || filter.object);
  // Remount the inputs when the URL filter changes so defaultValue follows it.
  const formKey = `${filter.user ?? ""}|${filter.relation ?? ""}|${filter.object ?? ""}`;

  return (
    <form
      key={formKey}
      role="search"
      aria-label="Filter tuples"
      className="flex items-center gap-2.5 border-b border-line-row px-6 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        for (const k of ["user", "relation", "object"] as const) {
          const v = String(data.get(k) ?? "").trim();
          if (v) params.set(k, v);
        }
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname);
      }}
    >
      <PrefixedInput name="user" defaultValue={filter.user} />
      <PrefixedInput name="relation" defaultValue={filter.relation} />
      <PrefixedInput name="object" defaultValue={filter.object} />
      <Button type="submit" variant="secondary" size="sm" className="h-[34px]">
        Filter
      </Button>
      {hasFilter && (
        <LinkButton href={pathname} variant="outline" size="sm" className="h-[34px]">
          Clear
        </LinkButton>
      )}
    </form>
  );
}
