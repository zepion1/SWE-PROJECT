import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { redact } from "../src/modules/m13-audit-reporting/service";
import { bearer, createTestApp, login } from "./helpers";

describe("M13 audit writer and audit log (F3, Q7)", () => {
  let t: ReturnType<typeof createTestApp>;
  beforeEach(() => {
    t = createTestApp({ seed: true });
  });

  it("records actor, time and before/after, and never stores sensitive keys", () => {
    t.ctx.audit.record({
      actor: { kind: "USER", userId: "user-manager", email: "manager@redhawk.test", roles: [] },
      storeId: "store-montclair",
      action: "TEST",
      entityType: "lot",
      entityId: "lot-amox-1",
      before: { qty: 1 },
      after: { qty: 2, nested: { passwordHash: "x", mfaSecret: "y", ok: true } },
    });
    const row = t.db.prepare("SELECT * FROM audit_events WHERE action = 'TEST'").get() as Record<string, string>;
    expect(row).toMatchObject({ actor_type: "USER", actor_id: "user-manager", store_id: "store-montclair" });
    expect(row.at).toBe("2026-11-19T15:00:00.000Z");
    expect(JSON.parse(row.after_json!)).toEqual({ qty: 2, nested: { ok: true } });
  });

  it("redacts password, secret, token and otp keys at any depth", () => {
    expect(redact({ a: 1, token: "t", list: [{ otp: "1", b: 2 }], userPassword: "p" })).toEqual({ a: 1, list: [{ b: 2 }] });
  });

  it("System Administrator reads the audit log, newest first, with filters", async () => {
    const admin = await login(t.app, "admin@redhawk.test");
    await login(t.app, "tech@redhawk.test");

    const res = await request(t.app).get("/api/v1/audit").query({ entityId: "user-tech" }).set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { action: string }) => e.action)).toEqual(["LOGIN_SUCCEEDED"]);

    const all = await request(t.app).get("/api/v1/audit").query({ limit: 1 }).set(bearer(admin));
    expect(all.body.data).toHaveLength(1);
  });

  it("other roles cannot read the audit log", async () => {
    const manager = await login(t.app, "manager@redhawk.test");
    expect((await request(t.app).get("/api/v1/audit").set(bearer(manager))).status).toBe(403);
  });
});
