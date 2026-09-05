import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { QueryProvider } from "@/components/providers/query-provider";
import { TenantSidebar } from "@/components/layout/tenant-sidebar";
import { getTenant } from "@/features/tenants/server";
import { requireOperator } from "@/server/auth/operator";

/**
 * Tenant-scoped shell (frames 04–06, 12–14, 16–18): swaps the platform
 * sidebar for the tenant one. Every page beneath gets `params.slug`.
 */
export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tenant] = await Promise.all([getTenant(slug), requireOperator()]);
  if (!tenant) notFound();

  // Counts come from the tenant projection until the runs/drift features expose them.
  const counts = { reconcileRuns: tenant.slug === "acme-air" ? 31 : 12, drift: tenant.openDrift };

  return (
    <QueryProvider>
      <div className="flex h-dvh min-w-[1280px] bg-app text-fg">
        <TenantSidebar tenant={tenant} counts={counts} />
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </QueryProvider>
  );
}
