import { z } from "zod";

/**
 * Wire shapes for /api/tenants/[slug]/identity-providers. A connection is
 * desired state: the form here edits the spec, and Zitadel sees the change
 * when the next generation applies. The client secret is write-only: it can
 * be sent in a PATCH and is never present in any response shape.
 */

export const IdpKindSchema = z.enum(["oidc", "saml"]);
export type IdpKind = z.infer<typeof IdpKindSchema>;

export const IdpStateSchema = z.enum(["pending_apply", "applied", "disabled"]);
export type IdpState = z.infer<typeof IdpStateSchema>;

export const ClaimMappingSchema = z.object({
  planeField: z.string().min(1),
  idpClaim: z.string().min(1),
});
export type ClaimMapping = z.infer<typeof ClaimMappingSchema>;

export const ProbeCheckSchema = z.object({
  label: z.string(),
  ok: z.boolean(),
});

/** Result of the SSRF-guarded discovery probe. A blocked probe is a result, not an HTTP error. */
export const ProbeResultSchema = z.discriminatedUnion("ok", [
  z.object({
    ok: z.literal(true),
    issuer: z.string(),
    durationMs: z.number().int().nonnegative(),
    resolvedIp: z.string(),
    checks: z.array(ProbeCheckSchema).min(1),
  }),
  z.object({
    ok: z.literal(false),
    issuer: z.string(),
    /** short label shown inline next to the issuer field */
    reason: z.string(),
    /** one sentence for the probe result card */
    detail: z.string(),
    checks: z.array(ProbeCheckSchema),
  }),
]);
export type ProbeResult = z.infer<typeof ProbeResultSchema>;

export const IdentityProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: IdpKindSchema,
  issuer: z.string(),
  /** host part of the issuer, for the card's "oidc · host" line */
  host: z.string(),
  clientId: z.string(),
  /** whether a secret is stored; the value itself never leaves the server */
  hasSecret: z.boolean(),
  state: IdpStateSchema,
  userCount: z.number().int().nonnegative(),
  /** Zitadel's id for the connection once created, e.g. "214785_idp1" */
  externalId: z.string().nullable(),
  /** shown instead of the host line when set (frame: "saml · phase 2") */
  note: z.string().nullable(),
  claimMappings: z.array(ClaimMappingSchema),
  lastProbe: ProbeResultSchema.nullable(),
  /** generation the pending edit belongs to, when state is pending_apply */
  stagedGeneration: z.number().int().positive().nullable(),
});
export type IdentityProvider = z.infer<typeof IdentityProviderSchema>;

export const IdpListSchema = z.object({
  slug: z.string(),
  items: z.array(IdentityProviderSchema),
  /** desired generation; edits stage into specGeneration + 1 */
  specGeneration: z.number().int().positive(),
});
export type IdpList = z.infer<typeof IdpListSchema>;

const IssuerSchema = z.string().trim().min(1).max(2048);

export const IdpPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    kind: IdpKindSchema.optional(),
    issuer: IssuerSchema.optional(),
    clientId: z.string().trim().min(1).max(256).optional(),
    /** write-only; replaces the stored secret when present */
    clientSecret: z.string().min(1).max(1024).optional(),
    claimMappings: z.array(ClaimMappingSchema).max(32).optional(),
  })
  .strict();
export type IdpPatch = z.infer<typeof IdpPatchSchema>;

export const ProbeRequestSchema = z.object({
  issuer: IssuerSchema,
  kind: IdpKindSchema.default("oidc"),
});
export type ProbeRequest = z.infer<typeof ProbeRequestSchema>;
export type ProbeRequestInput = z.input<typeof ProbeRequestSchema>;

export const StageResultSchema = z.object({
  id: z.string(),
  generation: z.number().int().positive(),
  stagedAt: z.string(),
  secretReplaced: z.boolean(),
});
export type StageResult = z.infer<typeof StageResultSchema>;

export const IDP_STATE_LABEL: Record<IdpState, string> = {
  pending_apply: "pending apply",
  applied: "applied",
  disabled: "disabled",
};
