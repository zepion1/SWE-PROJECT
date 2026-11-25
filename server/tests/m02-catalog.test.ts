import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { bearer, createTestApp, login } from "./helpers";

type TestApp = ReturnType<typeof createTestApp>;

const levothyroxine = {
  ndc: "00999-0701-30",
  genericName: "Levothyroxine",
  strength: "50 mcg",
  dosageForm: "Tablet",
  category: "Endocrine",
  scheduleClass: "NONE",
};

describe("M02 product catalog (F4)", () => {
  let t: TestApp;
  let manager: string;
  let tech: string;

  beforeEach(async () => {
    t = createTestApp({ seed: true });
    manager = await login(t.app, "manager@redhawk.test");
    tech = await login(t.app, "tech@redhawk.test");
  });

  const create = (body: object, token = manager) => request(t.app).post("/api/v1/products").set(bearer(token)).send(body);
  const list = (query: Record<string, string> = {}, token = tech) =>
    request(t.app).get("/api/v1/products").query(query).set(bearer(token));

  it("T25: keeps leading zeros in the NDC and finds the product by NDC", async () => {
    const res = await create(levothyroxine);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ndc: "00999-0701-30", brandName: null, active: true });

    const byNdc = await list({ q: "00999-0701" });
    expect(byNdc.body.data.items.map((p: { ndc: string }) => p.ndc)).toEqual(["00999-0701-30"]);
    const byDigits = await list({ q: "009990701" });
    expect(byDigits.body.data.items).toHaveLength(1);
  });

  it("T26: rejects a duplicate NDC with CONFLICT", async () => {
    const res = await create({ ...levothyroxine, ndc: "09999-0201-50" }); // seeded amoxicillin
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("T26: rejects a missing dosage form with VALIDATION_ERROR", async () => {
    const { dosageForm: _omit, ...withoutForm } = levothyroxine;
    expect((await create(withoutForm)).body.error.code).toBe("VALIDATION_ERROR");
    expect((await create({ ...levothyroxine, dosageForm: "   " })).status).toBe(400);
  });

  it("T26: a deactivated product is hidden from normal listings but still retrievable", async () => {
    const res = await request(t.app)
      .patch("/api/v1/products/prod-lisin")
      .set(bearer(manager))
      .send({ active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);

    const ids = (r: request.Response) => r.body.data.items.map((p: { id: string }) => p.id);
    expect(ids(await list({ q: "lisinopril" }))).toEqual([]);
    expect(ids(await list({ q: "lisinopril", includeInactive: "false" }))).toEqual([]);
    expect(ids(await list({ q: "lisinopril", includeInactive: "true" }))).toEqual(["prod-lisin"]);
    expect((await request(t.app).get("/api/v1/products/prod-lisin").set(bearer(tech))).body.data.active).toBe(false);
  });

  it("validates NDC format and schedule class on save (DDS §5.2)", async () => {
    expect((await create({ ...levothyroxine, ndc: "12AB-34" })).status).toBe(400);
    expect((await create({ ...levothyroxine, ndc: "123-456" })).status).toBe(400);
    expect((await create({ ...levothyroxine, scheduleClass: "2" })).status).toBe(400);
  });

  it("searches brand and generic names case-insensitively and treats % literally", async () => {
    const brand = await list({ q: "LIPITOR" });
    expect(brand.body.data.items.map((p: { id: string }) => p.id)).toEqual(["prod-atorva-brand"]);
    const generic = await list({ q: "atorva" });
    expect(generic.body.data.items).toHaveLength(2);
    expect((await list({ q: "%" })).body.data.items).toEqual([]);
  });

  it("paginates with an opaque cursor", async () => {
    const first = await list({ limit: "3" });
    expect(first.body.data.items).toHaveLength(3);
    expect(first.body.data.nextCursor).toEqual(expect.any(String));
    const second = await list({ limit: "3", cursor: first.body.data.nextCursor });
    const overlap = second.body.data.items.filter((p: { id: string }) =>
      first.body.data.items.some((q: { id: string }) => q.id === p.id),
    );
    expect(overlap).toEqual([]);
    expect((await list({ cursor: "garbage" })).status).toBe(400);
  });

  it("technicians can view but not change the catalog", async () => {
    expect((await list()).status).toBe(200);
    expect((await create(levothyroxine, tech)).status).toBe(403);
    expect((await request(t.app).patch("/api/v1/products/prod-amox").set(bearer(tech)).send({ active: false })).status).toBe(403);
  });

  it("returns 404 for an unknown product and 400 for an empty patch", async () => {
    expect((await request(t.app).patch("/api/v1/products/nope").set(bearer(manager)).send({ category: "X" })).status).toBe(404);
    expect((await request(t.app).patch("/api/v1/products/prod-amox").set(bearer(manager)).send({})).status).toBe(400);
  });

  it("F3: every catalog change is audited with before and after values", async () => {
    const created = await create(levothyroxine);
    const id = created.body.data.id as string;
    await request(t.app).patch(`/api/v1/products/${id}`).set(bearer(manager)).send({ scheduleClass: "IV" });
    await request(t.app).patch(`/api/v1/products/${id}`).set(bearer(manager)).send({ active: false });

    const events = t.db
      .prepare("SELECT actor_id, action, before_json, after_json FROM audit_events WHERE entity_id = ? ORDER BY rowid")
      .all(id) as { actor_id: string; action: string; before_json: string | null; after_json: string }[];
    expect(events.map((e) => e.action)).toEqual(["PRODUCT_CREATED", "PRODUCT_UPDATED", "PRODUCT_DEACTIVATED"]);
    expect(events.every((e) => e.actor_id === "user-manager")).toBe(true);
    expect(JSON.parse(events[1]!.before_json!).scheduleClass).toBe("NONE");
    expect(JSON.parse(events[1]!.after_json).scheduleClass).toBe("IV");
  });

  it("fails closed: if the audit write fails, the product is not saved (T16 pattern)", async () => {
    vi.spyOn(t.ctx.audit, "record").mockImplementation(() => {
      throw new Error("audit store unavailable");
    });
    const res = await create(levothyroxine);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    const count = t.db.prepare("SELECT COUNT(*) AS n FROM products WHERE ndc = ?").get(levothyroxine.ndc) as { n: number };
    expect(count.n).toBe(0);
  });
});
