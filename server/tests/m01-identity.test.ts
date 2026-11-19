import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { DEV_MFA_CODE } from "../src/adapters/stubs";
import { SEED_PASSWORD } from "../src/db/seed";
import { MAX_FAILED_LOGINS, SESSION_TTL_MS } from "../src/modules/m01-identity/service";
import { bearer, createTestApp, login, TEST_NOW } from "./helpers";

type TestApp = ReturnType<typeof createTestApp>;

const auditActions = (t: TestApp, entityId: string) =>
  (
    t.db.prepare("SELECT action FROM audit_events WHERE entity_id = ? ORDER BY rowid").all(entityId) as {
      action: string;
    }[]
  ).map((r) => r.action);

describe("M01 sign-in with MFA (F1)", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp({ seed: true });
  });

  it("valid password + one-time code returns a session and an audited LOGIN_SUCCEEDED", async () => {
    const res = await request(t.app)
      .post("/api/v1/auth/login")
      .send({ email: "manager@redhawk.test", password: SEED_PASSWORD, otp: DEV_MFA_CODE });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.expiresAt).toBe(new Date(Date.parse(TEST_NOW) + SESSION_TTL_MS).toISOString());
    expect(res.body.data.actor).toMatchObject({
      email: "manager@redhawk.test",
      displayName: "Morgan Manager",
      roles: [{ role: "PHARMACIST_MANAGER", storeId: "store-montclair" }],
    });
    expect(auditActions(t, "user-manager")).toEqual(["LOGIN_SUCCEEDED"]);
  });

  it("stores only a hash of the session token", async () => {
    const token = await login(t.app, "manager@redhawk.test");
    const rows = t.db.prepare("SELECT token_hash FROM sessions").all() as { token_hash: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]!.token_hash).not.toBe(token);
  });

  it("T21: correct password with a wrong one-time code is denied and audited", async () => {
    const res = await request(t.app)
      .post("/api/v1/auth/login")
      .send({ email: "manager@redhawk.test", password: SEED_PASSWORD, otp: "000000" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(auditActions(t, "user-manager")).toEqual(["LOGIN_FAILED"]);
  });

  it("T21: a locked user is denied even with correct credentials", async () => {
    t.db.prepare("UPDATE users SET status = 'LOCKED' WHERE id = 'user-tech'").run();
    const res = await request(t.app)
      .post("/api/v1/auth/login")
      .send({ email: "tech@redhawk.test", password: SEED_PASSWORD, otp: DEV_MFA_CODE });
    expect(res.status).toBe(401);
    const event = t.db
      .prepare("SELECT after_json FROM audit_events WHERE entity_id = 'user-tech' AND action = 'LOGIN_FAILED'")
      .get() as { after_json: string };
    expect(JSON.parse(event.after_json)).toEqual({ reason: "ACCOUNT_LOCKED" });
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} consecutive failures; an admin can unlock it`, async () => {
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) {
      await request(t.app)
        .post("/api/v1/auth/login")
        .send({ email: "tech@redhawk.test", password: "wrong-password", otp: DEV_MFA_CODE });
    }
    const status = () => (t.db.prepare("SELECT status FROM users WHERE id = 'user-tech'").get() as { status: string }).status;
    expect(status()).toBe("LOCKED");
    expect(auditActions(t, "user-tech")).toContain("ACCOUNT_LOCKED");

    const admin = await login(t.app, "admin@redhawk.test");
    const unlock = await request(t.app).post("/api/v1/admin/users/user-tech/unlock").set(bearer(admin));
    expect(unlock.status).toBe(200);
    expect(unlock.body.data.status).toBe("ACTIVE");
    await expect(login(t.app, "tech@redhawk.test")).resolves.toEqual(expect.any(String));
  });

  it("a successful login resets the failed-attempt counter", async () => {
    await request(t.app).post("/api/v1/auth/login").send({ email: "tech@redhawk.test", password: "nope", otp: DEV_MFA_CODE });
    await login(t.app, "tech@redhawk.test");
    const row = t.db.prepare("SELECT failed_login_count FROM users WHERE id = 'user-tech'").get() as {
      failed_login_count: number;
    };
    expect(row.failed_login_count).toBe(0);
  });

  it("unknown emails get the same generic 401 as wrong passwords", async () => {
    const unknown = await request(t.app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@redhawk.test", password: SEED_PASSWORD, otp: DEV_MFA_CODE });
    const wrong = await request(t.app)
      .post("/api/v1/auth/login")
      .send({ email: "manager@redhawk.test", password: "wrong", otp: DEV_MFA_CODE });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it("rejects malformed login input with VALIDATION_ERROR", async () => {
    const res = await request(t.app).post("/api/v1/auth/login").send({ email: "manager@redhawk.test", password: "x", otp: "12" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("M01 sessions", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp({ seed: true });
  });

  it("GET /auth/me returns the signed-in user", async () => {
    const token = await login(t.app, "tech@redhawk.test");
    const res = await request(t.app).get("/api/v1/auth/me").set(bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ userId: "user-tech", displayName: "Taylor Technician" });
  });

  it("sessions expire after the configured TTL", async () => {
    const token = await login(t.app, "tech@redhawk.test");
    t.clock.set(new Date(Date.parse(TEST_NOW) + SESSION_TTL_MS + 1000).toISOString());
    const res = await request(t.app).get("/api/v1/auth/me").set(bearer(token));
    expect(res.status).toBe(401);
  });

  it("logout revokes the token", async () => {
    const token = await login(t.app, "tech@redhawk.test");
    expect((await request(t.app).post("/api/v1/auth/logout").set(bearer(token))).status).toBe(200);
    expect((await request(t.app).get("/api/v1/auth/me").set(bearer(token))).status).toBe(401);
  });

  it("GET /stores lists only the caller's stores; the admin sees all", async () => {
    const names = async (email: string) => {
      const res = await request(t.app).get("/api/v1/stores").set(bearer(await login(t.app, email)));
      return res.body.data.map((s: { id: string }) => s.id);
    };
    expect(await names("tech.clifton@redhawk.test")).toEqual(["store-clifton"]);
    expect(await names("admin@redhawk.test")).toHaveLength(3);
  });

  it("an invalid token is treated as signed out", async () => {
    const res = await request(t.app).get("/api/v1/auth/me").set(bearer("not-a-real-token"));
    expect(res.status).toBe(401);
  });

  it("a session stops working once the user is locked", async () => {
    const token = await login(t.app, "tech@redhawk.test");
    t.db.prepare("UPDATE users SET status = 'LOCKED' WHERE id = 'user-tech'").run();
    expect((await request(t.app).get("/api/v1/auth/me").set(bearer(token))).status).toBe(401);
  });
});

describe("M01 store-scoped RBAC at the API (T18, T22)", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp({ seed: true });
  });

  it("T18: a manager cannot act on a store they are not assigned to", async () => {
    const token = await login(t.app, "manager@redhawk.test");
    const res = await request(t.app).get("/api/v1/stores/store-clifton/inventory").set(bearer(token));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("T22: admin creates a technician, who can sign in but cannot use manager or admin actions", async () => {
    const admin = await login(t.app, "admin@redhawk.test");
    const created = await request(t.app)
      .post("/api/v1/admin/users")
      .set(bearer(admin))
      .send({
        email: "New.Tech@RedHawk.test",
        displayName: "Nico Newtech",
        password: "a-long-temporary-password",
        roles: [{ role: "TECHNICIAN", storeId: "store-montclair" }],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.user).toMatchObject({ email: "new.tech@redhawk.test", status: "ACTIVE" });
    expect(created.body.data.mfaSetup.otpauthUri).toMatch(/^otpauth:\/\/totp\//);

    // Password stored hashed; the audit trail never contains secrets.
    const stored = t.db.prepare("SELECT password_hash FROM users WHERE email = 'new.tech@redhawk.test'").get() as {
      password_hash: string;
    };
    expect(stored.password_hash).toMatch(/^scrypt\$/);
    const audit = t.db.prepare("SELECT after_json FROM audit_events WHERE action = 'USER_CREATED'").get() as {
      after_json: string;
    };
    expect(audit.after_json).not.toMatch(/password|secret/i);

    const tech = await login(t.app, "new.tech@redhawk.test", "a-long-temporary-password");
    expect((await request(t.app).get("/api/v1/products").set(bearer(tech))).status).toBe(200);
    const product = await request(t.app)
      .post("/api/v1/products")
      .set(bearer(tech))
      .send({ ndc: "09999-0999-01", genericName: "Test", strength: "1 mg", dosageForm: "Tablet", category: "Other", scheduleClass: "NONE" });
    expect(product.status).toBe(403);
    expect((await request(t.app).get("/api/v1/admin/users").set(bearer(tech))).status).toBe(403);
  });

  it("only System Administrators can create staff accounts", async () => {
    const manager = await login(t.app, "manager@redhawk.test");
    const res = await request(t.app)
      .post("/api/v1/admin/users")
      .set(bearer(manager))
      .send({ email: "x@redhawk.test", displayName: "X", password: "a-long-temporary-password", roles: [{ role: "TECHNICIAN", storeId: "store-montclair" }] });
    expect(res.status).toBe(403);
  });

  it("rejects duplicate emails and invalid role/store combinations", async () => {
    const admin = await login(t.app, "admin@redhawk.test");
    const create = (body: object) => request(t.app).post("/api/v1/admin/users").set(bearer(admin)).send(body);
    const base = { displayName: "X", password: "a-long-temporary-password" };

    const dup = await create({ ...base, email: "MANAGER@redhawk.test", roles: [{ role: "TECHNICIAN", storeId: "store-montclair" }] });
    expect(dup.status).toBe(409);

    const noStore = await create({ ...base, email: "a@redhawk.test", roles: [{ role: "TECHNICIAN", storeId: null }] });
    expect(noStore.status).toBe(400);

    const scopedAdmin = await create({ ...base, email: "b@redhawk.test", roles: [{ role: "SYSTEM_ADMIN", storeId: "store-montclair" }] });
    expect(scopedAdmin.status).toBe(400);

    const badStore = await create({ ...base, email: "c@redhawk.test", roles: [{ role: "TECHNICIAN", storeId: "store-nowhere" }] });
    expect(badStore.status).toBe(400);

    const shortPassword = await create({ ...base, password: "short", email: "d@redhawk.test", roles: [{ role: "TECHNICIAN", storeId: "store-montclair" }] });
    expect(shortPassword.status).toBe(400);
  });

  it("lists staff users for the administrator without password hashes or MFA secrets", async () => {
    const admin = await login(t.app, "admin@redhawk.test");
    const res = await request(t.app).get("/api/v1/admin/users").set(bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(4);
    expect(JSON.stringify(res.body)).not.toMatch(/scrypt|REDHAWK/);
  });
});
