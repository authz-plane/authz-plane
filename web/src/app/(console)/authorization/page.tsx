import type { Metadata } from "next";
import Link from "next/link";
import { Topbar } from "@/components/layout/topbar";
import { LinkButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Eyebrow } from "@/components/ui/eyebrow";
import { toneForPhase } from "@/lib/phase";
import { listTenants } from "@/features/tenants/server";

export const metadata: Metadata = { title: "Authorization" };

/**
 * Platform-level entry to the authorization model. Models are per tenant, so
 * this page is a picker: one card per tenant into
 * /tenants/{slug}/authorization-model, plus the playground for ad-hoc checks.
 */
export default async function AuthorizationPage() {
  const page = await listTenants({ limit: 100 });

  return (
    <>
      <Topbar
        title="Authorization"
        meta="pick a tenant · models are scoped per tenant"
        actions={
          <LinkButton href="/playground" variant="secondary" size="sm">
            Open playground
          </LinkButton>
        }
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto px-7 py-6">
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Authorization models · {page.items.length} tenants</Eyebrow>
          <p className="max-w-[560px] text-[13px] leading-[1.6] text-fg-secondary">
            Every tenant owns its own OpenFGA store, model version and role projection. Pick one to inspect its type
            graph and DSL, or open the playground to run a check against any tenant.
          </p>
        </div>

        <ul className="grid grid-cols-3 gap-3">
          {page.items.map((tenant) => {
            const stuck = tenant.generation !== tenant.observedGeneration;
            return (
              <li key={tenant.slug}>
                <Link
                  href={`/tenants/${tenant.slug}/authorization-model`}
                  className="flex h-full flex-col gap-3 rounded-card border border-line bg-card p-4 text-fg transition-colors duration-[120ms] hover:border-line-control hover:bg-hover hover:text-fg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-[3px]">
                      <span className="truncate text-[13.5px] font-medium">{tenant.displayName}</span>
                      <span className="truncate font-mono text-[11px] text-fg-meta">{tenant.slug}</span>
                    </div>
                    <Chip tone={toneForPhase(tenant.phase)}>{tenant.phase}</Chip>
                  </div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-fg-meta">
                    <span>
                      gen <span className={stuck ? "text-degraded" : "text-fg-secondary"}>{tenant.generation}</span> / obs{" "}
                      {tenant.observedGeneration}
                    </span>
                    <span className="text-link">authorization model →</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="font-mono text-[11px] text-fg-meta">
          Need a one-off check or explain?{" "}
          <Link href="/playground" className="text-link hover:underline">
            /playground
          </Link>{" "}
          runs check, batch-check and explain against any tenant.
        </p>
      </div>
    </>
  );
}
