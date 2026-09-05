"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { SplitBody } from "@/components/layout/page-header";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { LinkButton } from "@/components/ui/button";
import { TenantTopbar } from "@/features/authz-model/components/tenant-topbar";
import { bffGet } from "@/lib/api/client";
import { rolesKeys } from "../keys";
import { RolesResponseSchema, type Role, type RolesResponse } from "../schemas";
import { RoleInspector } from "./role-inspector";
import { RolesMatrix } from "./roles-matrix";

/** Default selection: the staged role if any (it is the one needing attention), else the first. */
function pickDefault(roles: Role[]): string | null {
  return roles.find((r) => r.staged)?.key ?? roles[0]?.key ?? null;
}

/**
 * Screen 13. Selection lives in ?role= so a view is shareable; the matrix on
 * the left and the inspector on the right both read from the same query.
 */
export function RolesView({ slug, initialRole }: { slug: string; initialRole: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, error } = useQuery<RolesResponse>({
    queryKey: rolesKeys.list(slug),
    queryFn: () => bffGet(`/api/tenants/${encodeURIComponent(slug)}/roles`, RolesResponseSchema),
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(initialRole);

  if (!data) {
    return (
      <>
        <TenantTopbar slug={slug} title="Roles & permissions" />
        <div className="p-6">
          <ProblemNotice title="Roles unavailable" detail={error instanceof Error ? error.message : "no data"} />
        </div>
      </>
    );
  }

  const roles = data.items;
  const applied = roles.filter((r) => !r.staged).length;
  const selected = roles.find((r) => r.key === selectedKey) ?? roles.find((r) => r.key === pickDefault(roles)) ?? null;

  const select = (key: string) => {
    setSelectedKey(key);
    const params = new URLSearchParams();
    params.set("role", key);
    router.replace(`${pathname}?${params.toString()}`);
  };

  return (
    <>
      <TenantTopbar slug={slug} title="Roles & permissions" meta={`${applied} roles · spec-owned`} />
      <SplitBody
        panelWidth={340}
        panel={
          selected ? (
            <RoleInspector
              key={selected.key}
              slug={slug}
              role={selected}
              onDeleted={() => setSelectedKey(null)}
            />
          ) : (
            <div className="p-4 font-mono text-[11px] text-fg-meta">select a role to inspect it</div>
          )
        }
      >
        <div className="flex flex-col gap-4 p-6">
          {roles.length === 0 ? (
            <EmptyState eyebrow="empty · no roles" title="No roles in this spec">
              Roles are declared in the tenant spec under <span className="font-mono">authorization.roles</span>. Add one
              in the spec editor; it appears here once the generation is saved.
              <div className="pt-3">
                <LinkButton href={`/tenants/${slug}/spec`} variant="secondary" size="sm">
                  Open spec editor
                </LinkButton>
              </div>
            </EmptyState>
          ) : (
            <RolesMatrix roles={roles} selectedKey={selected?.key ?? null} onSelect={select} />
          )}
          <p className="font-mono text-[11px] text-fg-meta">
            spec generation {data.specGeneration} · {roles.filter((r) => r.staged).length} staged · roles bind to tuples
            through relation names, so a bound role cannot be deleted
          </p>
        </div>
      </SplitBody>
    </>
  );
}
