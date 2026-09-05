import { Button, LinkButton } from "@/components/ui/button";
import { TerminalFailure } from "@/components/states/system-states";
import type { TenantDetail } from "@/features/tenants/schemas";
import { spanLabel } from "./countdown";

/** Screen 20 quadrant 3 in place: Failed is terminal, a human decides. */
export function FailedTenantNotice({
  tenant,
  onReconcileAnyway,
  reconciling,
}: {
  tenant: TenantDetail;
  onReconcileAnyway: () => void;
  reconciling: boolean;
}) {
  const err = tenant.lastError;
  const code = err ? (/(\d{3} [a-z_]+)/.exec(err.message)?.[1] ?? err.message) : "unknown error";
  return (
    <TerminalFailure
      title={`${tenant.slug} is Failed`}
      summary={
        err
          ? `${err.attempt} of ${err.maxAttempts} attempts exhausted over ${spanLabel(tenant.observedLagSeconds)}. The reconciler stopped at generation ${tenant.generation}; observed is still ${tenant.observedGeneration}. Nothing retries until the spec changes or an operator reconciles by hand.`
          : `The reconciler stopped at generation ${tenant.generation}; observed is still ${tenant.observedGeneration}.`
      }
      errorLines={err ? [code, err.message] : ["no error recorded"]}
      actions={
        <>
          <LinkButton variant="danger" size="md" href={`/tenants/${tenant.slug}/spec`}>
            Fix spec &amp; reconcile
          </LinkButton>
          <Button variant="outline" size="md" onClick={onReconcileAnyway} disabled={reconciling}>
            {reconciling ? "Enqueuing…" : "Reconcile anyway"}
          </Button>
          {err && (
            <LinkButton variant="outline" size="md" href={`/reconcile-runs/${err.runId}`}>
              Open failed run
            </LinkButton>
          )}
        </>
      }
    />
  );
}
