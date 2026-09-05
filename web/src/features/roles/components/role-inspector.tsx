"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ProblemNotice } from "@/components/states/system-states";
import { BffError, bffMutate } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { rolesKeys } from "../keys";
import { RoleDeleteResultSchema, type Role, type RoleDeleteResult } from "../schemas";

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}</span>
      <span className={cn("font-mono text-fg", tone)}>{value}</span>
    </div>
  );
}

/**
 * Right 340px column of frame 13: role facts, the spec-owned note and the
 * "Open in spec editor" action, then the red Delete guard with the danger
 * button that exercises the 409 path.
 */
export function RoleInspector({
  slug,
  role,
  onDeleted,
}: {
  slug: string;
  role: Role;
  onDeleted: (result: RoleDeleteResult) => void;
}) {
  const queryClient = useQueryClient();
  const [lastDeleted, setLastDeleted] = useState<RoleDeleteResult | null>(null);

  const remove = useMutation({
    mutationFn: (key: string) =>
      bffMutate(
        `/api/tenants/${encodeURIComponent(slug)}/roles/${encodeURIComponent(key)}`,
        { method: "DELETE" },
        RoleDeleteResultSchema,
      ),
    onSuccess: async (result) => {
      setLastDeleted(result);
      onDeleted(result);
      // Removing a role is a spec write: roles, tenant, spec versions and runs change.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: rolesKeys.list(slug) }),
        queryClient.invalidateQueries({ queryKey: ["tenant", slug] }),
        queryClient.invalidateQueries({ queryKey: ["spec", slug] }),
        queryClient.invalidateQueries({ queryKey: ["runs"] }),
      ]);
    },
  });

  const bound = role.boundTuples;
  const error = remove.error;
  const problem =
    error instanceof BffError
      ? { title: `${error.status} · ${error.title}`, detail: error.detail }
      : error
        ? { title: "Delete failed", detail: error.message }
        : null;

  return (
    <div className="flex flex-col gap-3 p-4">
      <Card className="flex flex-col gap-3 p-4">
        <CardTitle className={role.staged ? "text-ready" : undefined}>{role.key}</CardTitle>
        <div className="flex flex-col gap-2 text-[12.5px] text-fg-secondary">
          <Row label="key" value={role.key} />
          <Row label="permissions" value={String(role.permissions.length)} />
          <Row label="bound tuples" value={String(bound)} tone={bound > 0 ? undefined : "text-fg-secondary"} />
          <Row
            label="source"
            value={`spec gen ${role.source.generation}${role.staged ? " · staged" : ""}`}
            tone="text-link"
          />
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="granted permissions">
          {role.permissions.map((p) => (
            <li key={p} className="rounded-chip bg-selected px-[7px] py-[2px] font-mono text-[10.5px] text-fg-secondary">
              {p}
            </li>
          ))}
        </ul>
        <div className="h-px bg-line" />
        <p className="font-mono text-[11px] leading-[1.7] text-fg-meta">
          Roles are spec-owned — editing stages a spec change; it does not write to the authorization store directly.
        </p>
        <LinkButton href={`/tenants/${slug}/spec`} variant="secondary" size="sm" className="h-[34px] w-full">
          Open in spec editor
        </LinkButton>
      </Card>

      <Card className="flex flex-col gap-2.5 border-failed-border bg-failed-tint p-4">
        <h3 className="text-[13px] font-semibold text-failed">Delete guard</h3>
        <p className="text-[12.5px] leading-[1.55] text-fg-secondary">
          {bound > 0
            ? `${role.key} is bound to ${bound} tuple${bound === 1 ? "" : "s"}. Deleting it returns 409 until those relations are removed.`
            : `${role.key} is bound to 0 tuples. Deleting it stages the removal into the next spec generation (202).`}
        </p>
        {problem && <ProblemNotice title={problem.title} detail={problem.detail} />}
        {lastDeleted && lastDeleted.key !== role.key && (
          <p role="status" className="font-mono text-[11px] text-ready">
            ✓ {lastDeleted.key} removed · staged into generation {lastDeleted.generation}
          </p>
        )}
        <Button
          variant="danger"
          size="sm"
          className="self-start"
          disabled={remove.isPending}
          onClick={() => remove.mutate(role.key)}
        >
          Delete role
        </Button>
      </Card>
    </div>
  );
}
