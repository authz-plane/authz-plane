import type { Metadata } from "next";
import { NewTenantWizard } from "@/features/tenants/components/new-tenant/new-tenant-wizard";
import { listTenants } from "@/features/tenants/server";

export const metadata: Metadata = { title: "New tenant" };

/**
 * Screen 19. The wizard is one client component (form state spans the three
 * steps); the server only supplies the tenants the "Copy from tenant" card
 * can clone. Step is `?step=identity|authorization|review`, read on the client.
 */
export default async function NewTenantPage() {
  const page = await listTenants({ limit: 100 });
  const tenantOptions = page.items.map((t) => ({ slug: t.slug, displayName: t.displayName }));
  return <NewTenantWizard tenantOptions={tenantOptions} />;
}
