"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ProblemNotice } from "@/components/states/system-states";
import { AlertStrip } from "@/components/ui/alert-strip";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Drawer, OverlayFooter, OverlayHeader } from "@/components/ui/overlay";
import { bffMutate, BffError } from "@/lib/api/client";
import { InviteRequestSchema, InviteResultSchema, type InviteResult } from "../schemas";

function problemOf(error: unknown): { title: string; detail?: string } {
  if (error instanceof BffError) return { title: `${error.status} · ${error.title}`, detail: error.detail };
  return { title: "Invite failed", detail: error instanceof Error ? error.message : undefined };
}

/**
 * Invite user (frame 18 topbar action). The invite goes to the IdP; the user
 * appears in the mirror only after the IdP reports them and a resync runs.
 * Nothing here writes a user record. The parent mounts this per open and
 * passes a stable `onClose`, so the Drawer's focus trap is not re-armed on
 * every keystroke and the form state resets naturally on close.
 */
export function InviteDrawer({ slug, roles, open, onClose }: { slug: string; roles: string[]; open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(roles[0] ?? "");
  const [validation, setValidation] = useState<string | null>(null);
  const [sent, setSent] = useState<InviteResult | null>(null);

  const invite = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      bffMutate(`/api/tenants/${encodeURIComponent(slug)}/users/invite`, { method: "POST", body }, InviteResultSchema),
    onSuccess: (result) => {
      setSent(result);
      setEmail("");
    },
  });

  const submit = () => {
    const parsed = InviteRequestSchema.safeParse({ email: email.trim(), role });
    if (!parsed.success) {
      setValidation(parsed.error.issues[0]?.message ?? "invalid invite");
      return;
    }
    setValidation(null);
    setSent(null);
    invite.mutate(parsed.data);
  };

  return (
    <Drawer open={open} onClose={onClose} title="Invite user">
      <OverlayHeader title="Invite user" meta={`${slug} · sent through the IdP · appears here after the next resync`} onClose={onClose} />
      <form
        id="invite-form"
        className="flex flex-1 flex-col gap-5 overflow-auto px-6 py-5"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {sent && (
          <AlertStrip
            tone="ready"
            title={`Invite sent to ${sent.email}`}
            detail={`role ${sent.role} · ${sent.inviteId} · expires ${sent.expiresAt.slice(0, 10)}`}
          />
        )}
        {invite.error && <ProblemNotice {...problemOf(invite.error)} onRetry={() => invite.reset()} />}
        <Field label="Email" htmlFor="invite-email" hint={validation ? <span className="text-failed">{validation}</span> : "the IdP sends the invitation; the address is not stored here"}>
          <Input
            id="invite-email"
            mono
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@acme-air.test"
            autoComplete="off"
            spellCheck={false}
            invalid={Boolean(validation)}
          />
        </Field>
        <Field label="Role" htmlFor="invite-role" hint="from the tenant spec">
          <Select id="invite-role" mono value={role} onChange={(e) => setRole(e.target.value)}>
            {roles.map((r) => (
              <option key={r} value={r} className="bg-elevated text-fg">
                {r}
              </option>
            ))}
          </Select>
        </Field>
        <p className="font-mono text-[11px] leading-[1.7] text-fg-meta">
          user records are owned by the IdP · the mirror updates when the resync run reports the new account
        </p>
      </form>
      <OverlayFooter>
        <Button variant="outline" onClick={onClose}>
          {sent ? "Done" : "Cancel"}
        </Button>
        <Button variant="primary" onClick={submit} disabled={invite.isPending || !email.trim() || !role}>
          {invite.isPending ? "Sending…" : "Send invite"}
        </Button>
      </OverlayFooter>
    </Drawer>
  );
}
