import { beforeEach, describe, expect, it } from "vitest";
import { TENANTS } from "@/features/tenants/fixtures";
import { AUDIT_EVENTS } from "./fixtures";
import { ACTION_TONE, eventJson, shortId, utcTime } from "./format";
import { auditKeys, normalizeAuditFilter } from "./keys";
import { AuditEventSchema, AuditPageSchema, auditFilterFromSearch, ExportResponseSchema } from "./schemas";
import { AUDIT_PAGE_SIZE, listAuditEvents, requestAuditExport, resetAuditExportsForTests } from "./server";

beforeEach(() => resetAuditExportsForTests());

describe("audit fixtures", () => {
  it("every event satisfies the schema, has a unique id and belongs to a canonical tenant", () => {
    const slugs = new Set(TENANTS.map((t) => t.slug));
    for (const e of AUDIT_EVENTS) {
      expect(() => AuditEventSchema.parse(e)).not.toThrow();
      expect(slugs.has(e.tenant), e.tenant).toBe(true);
    }
    expect(new Set(AUDIT_EVENTS.map((e) => e.id)).size).toBe(AUDIT_EVENTS.length);
  });

  it("is ordered newest-first within each tenant, as the (tenant_id, occurred_at DESC) index returns", () => {
    const acme = AUDIT_EVENTS.filter((e) => e.tenant === "acme-air");
    expect(acme).toHaveLength(14);
    for (let i = 1; i < acme.length; i++) {
      expect(Date.parse(acme[i - 1]!.occurredAt)).toBeGreaterThan(Date.parse(acme[i]!.occurredAt));
    }
  });

  it("tells the same story as the run and drift fixtures", () => {
    const spec = AUDIT_EVENTS.find((e) => e.action === "SpecUpdated" && e.resource === "tenant:acme-air gen 9")!;
    expect(utcTime(spec.occurredAt, true)).toBe("10:14:22.481Z");
    expect(shortId(spec.requestId)).toBe("4bf9…a1");
    expect(spec.relatedRunId).toBe("8f1c9e4b27d2");
    expect(spec.specHash).toBe(TENANTS.find((t) => t.slug === "acme-air")?.specHash);
    const degraded = AUDIT_EVENTS.find((e) => e.action === "ReconcileDegraded")!;
    expect(degraded.requestId).toBe(spec.requestId);
    const globexDrift = AUDIT_EVENTS.find((e) => e.tenant === "globex-logistics" && e.action === "DriftDetected")!;
    expect(utcTime(globexDrift.occurredAt)).toBe("10:08:41Z");
    expect(shortId(globexDrift.requestId)).toBe("a7d3…0c");
    // System actors have no client ip; humans and m2m do.
    for (const e of AUDIT_EVENTS) expect(e.ip === null, e.id).toBe(e.actor.kind === "system");
  });
});

describe("format", () => {
  it("colours every action and shortens ids the way the frame reads", () => {
    expect(ACTION_TONE.SpecUpdated).toBe("link");
    expect(ACTION_TONE.ReconcileDegraded).toBe("degraded");
    expect(ACTION_TONE.DriftDetected).toBe("drift");
    expect(ACTION_TONE.RelationsWritten).toBe("ready");
    expect(ACTION_TONE.TupleWritten).toBe("ready");
    expect(ACTION_TONE.IdpSecretRotated).toBe("failed");
    expect(ACTION_TONE.CheckExplained).toBe("link");
    expect(shortId("4bf9e2c7d81a03b6f5a1")).toBe("4bf9…a1");
    expect(shortId("4bf9e2c7d81a03b6f5a1", 8, 2)).toBe("4bf9e2c7…a1");
    expect(shortId("short")).toBe("short");
    expect(utcTime("2026-09-04T09:00:00.012Z")).toBe("09:00:00Z");
    expect(JSON.parse(eventJson(AUDIT_EVENTS[0]!))).toEqual(AUDIT_EVENTS[0]);
  });

  it("filter parsing drops unknown actions and empty values; keys normalise to defined fields", () => {
    expect(auditFilterFromSearch({ actor: "ci-bot", action: "SpecUpdated", tenant: "" })).toEqual({ actor: "ci-bot", action: "SpecUpdated" });
    expect(auditFilterFromSearch(new URLSearchParams("action=Bogus&event=evt_1"))).toEqual({});
    expect(normalizeAuditFilter({ actor: undefined, action: "TupleWritten" })).toEqual({ action: "TupleWritten" });
    expect(auditKeys.list("acme-air", {})).toEqual(["audit", "acme-air", {}]);
    expect(auditKeys.list(null, { tenant: "acme-air" })).toEqual(["audit", "platform", { tenant: "acme-air" }]);
  });
});

describe("listAuditEvents", () => {
  it("pages acme-air's 14 events: a full first page with a cursor, the rest, then null", async () => {
    const p1 = (await listAuditEvents({ tenant: "acme-air" }, undefined))!;
    expect(() => AuditPageSchema.parse(p1)).not.toThrow();
    expect(p1.items).toHaveLength(AUDIT_PAGE_SIZE);
    expect(p1.nextCursor).toBe(`c${AUDIT_PAGE_SIZE}`);
    expect(p1.total).toBe(2418);
    expect(p1.items[0]?.action).toBe("ReconcileDegraded");
    expect(p1.actors.map((a) => a.id)).toEqual(["admin@acme-air.test", "ci-bot", "ops@acme-air.test", "system:reconciler"]);

    const p2 = (await listAuditEvents({ tenant: "acme-air" }, p1.nextCursor!))!;
    expect(p2.items).toHaveLength(14 - AUDIT_PAGE_SIZE);
    expect(p2.nextCursor).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((e) => e.id)).size).toBe(14);
  });

  it("filters by actor and by action, reporting the filtered count as total", async () => {
    const bot = (await listAuditEvents({ tenant: "acme-air", actor: "ci-bot" }, undefined))!;
    expect(bot.items.every((e) => e.actor.id === "ci-bot")).toBe(true);
    expect(bot.items).toHaveLength(2);
    expect(bot.total).toBe(2);
    expect(bot.nextCursor).toBeNull();

    const drift = (await listAuditEvents({ tenant: "acme-air", action: "DriftDetected" }, undefined))!;
    expect(drift.items.map((e) => e.resource)).toEqual(["zitadel.org displayName", "fga.model document#viewer"]);

    const none = (await listAuditEvents({ tenant: "acme-air", actor: "ci-bot", action: "SpecUpdated" }, undefined))!;
    expect(none.items).toEqual([]);
    expect(none.total).toBe(0);
  });

  it("platform scope spans tenants and can narrow to one; unknown tenants yield null", async () => {
    const all = (await listAuditEvents({}, undefined))!;
    expect(all.total).toBe(9731);
    expect(new Set(all.items.map((e) => e.tenant)).size).toBeGreaterThan(1);
    expect(all.nextCursor).toBe("c8");
    const globex = (await listAuditEvents({ tenant: "globex-logistics" }, undefined))!;
    expect(globex.items.every((e) => e.tenant === "globex-logistics")).toBe(true);
    expect(globex.total).toBe(1207);
    expect(await listAuditEvents({ tenant: "nobody" }, undefined)).toBeNull();
  });

  it("ignores a malformed cursor and starts from the top", async () => {
    const page = (await listAuditEvents({ tenant: "acme-air" }, "garbage"))!;
    expect(page.items[0]?.id).toBe(AUDIT_EVENTS[0]?.id);
  });
});

describe("requestAuditExport", () => {
  it("queues an ndjson.gz export and replays the same id for the same Idempotency-Key", async () => {
    const a = (await requestAuditExport("acme-air", "key-1"))!;
    expect(() => ExportResponseSchema.parse(a)).not.toThrow();
    expect(a.exportId).toMatch(/^exp_[0-9a-f]{10}$/);
    expect(a.status).toBe("queued");
    expect(await requestAuditExport("acme-air", "key-1")).toEqual(a);
    expect((await requestAuditExport("acme-air", "key-2"))!.exportId).not.toBe(a.exportId);
    expect(await requestAuditExport("nobody", "key-3")).toBeNull();
  });
});
