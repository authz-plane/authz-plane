"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Sidebar item: 9×10 padding, radius 7, 13.5px. Active = bg/selected + primary
 * text at weight 500; hover = bg/hover, 120ms ease. Counts are mono 11px.
 * `exact` makes only the exact path active (tenant Overview).
 */
export function NavItem({
  href,
  children,
  count,
  countClassName,
  exact,
}: {
  href: string;
  children: ReactNode;
  count?: number;
  countClassName?: string;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center justify-between rounded-control px-2.5 py-[9px] text-[13.5px] transition-colors duration-[120ms] ease-out",
        active ? "bg-selected font-medium text-fg" : "text-fg-tertiary hover:bg-hover hover:text-fg",
      )}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span className={cn("font-mono text-[11px] text-fg-meta", countClassName)}>{count}</span>
      )}
    </Link>
  );
}
