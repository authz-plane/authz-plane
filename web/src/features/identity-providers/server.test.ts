import { beforeEach, describe, expect, it } from "vitest";
import { IdpListSchema } from "./schemas";
import {
  getIdentityProvider,
  listIdentityProviders,
  resetIdentityProviderStore,
  stageIdentityProvider,
  testIdentityProvider,
} from "./server";

const NOW = new Date("2026-09-04T10:15:00Z");

describe("identity-providers server", () => {
  beforeEach(() => resetIdentityProviderStore());

  it("lists acme-air's two connections exactly as frame 16 shows them", async () => {
    const list = await listIdentityProviders("acme-air");
    expect(list).not.toBeNull();
    expect(IdpListSchema.parse(list)).toEqual(list);
    expect(list!.specGeneration).toBe(9);
    const [entra, saml] = list!.items;
    expect(entra).toMatchObject({
      id: "acme-entra",
      kind: "oidc",
      host: "login.microsoftonline.com",
      state: "pending_apply",
      userCount: 312,
      externalId: "214785_idp1",
      hasSecret: true,
      stagedGeneration: 10,
    });
    expect(entra!.claimMappings.map((m) => `${m.planeField}↔${m.idpClaim}`)).toEqual([
      "email↔preferred_username",
      "name↔name",
      "groups↔groups",
      "externalId↔oid",
    ]);
    expect(entra!.lastProbe).toMatchObject({ ok: true, durationMs: 240 });
    expect(saml).toMatchObject({ id: "acme-legacy-saml", kind: "saml", state: "disabled", note: "saml · phase 2" });
  });

  it("derives one connection per desired entry for other tenants", async () => {
    const list = await listIdentityProviders("northwind-rail");
    expect(list!.items).toHaveLength(1);
    expect(list!.items[0]).toMatchObject({ id: "northwind-okta", kind: "oidc", host: "idp.northwind-rail.example", state: "pending_apply" });
    expect(await listIdentityProviders("no-such-tenant")).toBeNull();
  });

  it("gets one connection and 404s the rest", async () => {
    const ok = await getIdentityProvider("acme-air", "acme-entra");
    expect(ok.ok).toBe(true);
    const missing = await getIdentityProvider("acme-air", "nope");
    expect(missing).toMatchObject({ ok: false, status: 404, title: "Identity provider not found" });
    const noTenant = await getIdentityProvider("nope", "acme-entra");
    expect(noTenant).toMatchObject({ ok: false, status: 404, title: "Tenant not found" });
  });

  it("stages an edit into generation 10 and never keeps the secret value", async () => {
    const r = await stageIdentityProvider("acme-air", "acme-entra", { clientId: "new-client", clientSecret: "hunter2-not-a-real-secret" }, NOW);
    expect(r).toEqual({
      ok: true,
      data: { id: "acme-entra", generation: 10, stagedAt: "2026-09-04T10:15:00.000Z", secretReplaced: true },
    });
    const after = await getIdentityProvider("acme-air", "acme-entra");
    expect(after.ok && after.data.clientId).toBe("new-client");
    expect(after.ok && after.data.hasSecret).toBe(true);
    expect(JSON.stringify(after)).not.toContain("hunter2");
    const list = await listIdentityProviders("acme-air");
    expect(JSON.stringify(list)).not.toContain("hunter2");
  });

  it("flips hasSecret on when a disabled saml connection receives one, but keeps it disabled", async () => {
    const r = await stageIdentityProvider("acme-air", "acme-legacy-saml", { clientSecret: "x" }, NOW);
    expect(r.ok).toBe(true);
    const after = await getIdentityProvider("acme-air", "acme-legacy-saml");
    expect(after.ok && after.data).toMatchObject({ hasSecret: true, state: "disabled", stagedGeneration: 10 });
  });

  it("refuses to stage an issuer the SSRF guard blocks", async () => {
    const r = await stageIdentityProvider("acme-air", "acme-entra", { issuer: "http://10.0.0.1/" }, NOW);
    expect(r).toMatchObject({ ok: false, status: 422, title: "Issuer rejected" });
    const ok = await stageIdentityProvider("acme-air", "acme-entra", { issuer: "https://idp.acme-air.test/oidc" }, NOW);
    expect(ok.ok).toBe(true);
    const after = await getIdentityProvider("acme-air", "acme-entra");
    expect(after.ok && after.data.host).toBe("idp.acme-air.test");
  });

  it("test records the probe result on the connection", async () => {
    const blocked = await testIdentityProvider("acme-air", "acme-entra", { issuer: "https://localhost/", kind: "oidc" });
    expect(blocked.ok && blocked.data).toMatchObject({ ok: false, reason: "blocked by SSRF guard" });
    const after = await getIdentityProvider("acme-air", "acme-entra");
    expect(after.ok && after.data.lastProbe).toMatchObject({ ok: false, issuer: "https://localhost/" });
    expect(await testIdentityProvider("acme-air", "nope", { issuer: "https://a.example/", kind: "oidc" })).toMatchObject({ ok: false, status: 404 });
  });
});
