"use client";

import { useQuery } from "@tanstack/react-query";
import { EmptyState, ProblemNotice } from "@/components/states/system-states";
import { LinkButton } from "@/components/ui/button";
import { bffGet } from "@/lib/api/client";
import { idpKeys } from "../keys";
import { IdpListSchema, type IdpList } from "../schemas";
import { ConnectionForm } from "./connection-form";
import { ConnectionList } from "./connection-list";

/**
 * Screen 16. Selection is route-addressable (?idp=); the page resolves it and
 * passes `selectedId`, so a shared link opens the same connection.
 */
export function IdpView({ slug, selectedId }: { slug: string; selectedId: string | null }) {
  const { data, error } = useQuery<IdpList>({
    queryKey: idpKeys.list(slug),
    queryFn: () => bffGet(`/api/tenants/${encodeURIComponent(slug)}/identity-providers`, IdpListSchema),
  });

  if (!data) {
    return (
      <div className="p-6">
        <ProblemNotice title="Identity providers unavailable" detail={error instanceof Error ? error.message : "no data"} />
      </div>
    );
  }

  const selected = data.items.find((i) => i.id === selectedId) ?? data.items[0] ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <ConnectionList slug={slug} items={data.items} selectedId={selected?.id ?? null} />
      {selected ? (
        <ConnectionForm key={`${selected.id}-${selected.stagedGeneration ?? 0}`} slug={slug} idp={selected} specGeneration={data.specGeneration} />
      ) : (
        <div className="flex flex-1 flex-col">
          <EmptyState eyebrow="empty · no connections" title="No identity providers in this spec">
            Connections are declared in the tenant spec under <span className="font-mono">identityProviders</span>. Add one in the
            spec editor; the reconciler creates it in Zitadel when the generation applies.
            <div className="pt-3">
              <LinkButton href={`/tenants/${slug}/spec`} variant="secondary" size="sm">
                Open spec editor
              </LinkButton>
            </div>
          </EmptyState>
        </div>
      )}
    </div>
  );
}
