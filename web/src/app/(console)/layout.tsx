import type { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { Sidebar } from "@/components/layout/sidebar";
import { requireOperator } from "@/server/auth/operator";
import { getShellSummary } from "@/features/dashboard/server";

/**
 * Console shell: 236px sidebar + a main column that owns its own scroll.
 * Server component; the sidebar's counts and dependency health come from the
 * same data module the pages use.
 */
export default async function ConsoleLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [operator, summary] = await Promise.all([
    requireOperator(),
    getShellSummary(),
  ]);

  return (
    <QueryProvider>
      <div className="flex h-dvh min-w-[1280px] bg-app text-fg">
        <Sidebar summary={summary} operator={operator} />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </QueryProvider>
  );
}
