import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp } from "./helpers";

/**
 * Skeleton contract: every DDS §8 route is mounted, staff routes fail closed
 * without a session, and unbuilt modules answer 501 NOT_IMPLEMENTED.
 * Replace these with real behaviour tests as each module is implemented.
 */
describe("skeleton routing", () => {
  const { app } = createTestApp({ seed: true });

  it.each([
    ["get", "/api/v1/products"],
    ["post", "/api/v1/stores/store-montclair/receipts"],
    ["get", "/api/v1/stores/store-montclair/inventory"],
    ["post", "/api/v1/adjustments"],
    ["post", "/api/v1/adjustments/adj-1/approve"],
    ["get", "/api/v1/stores/store-montclair/expiring"],
    ["post", "/api/v1/orders"],
    ["post", "/api/v1/orders/po-1/approve"],
    ["get", "/api/v1/forecast/sp-montclair-amox"],
    ["post", "/api/v1/recommendations/rec-1/review"],
    ["get", "/api/v1/stores/store-montclair/dashboard"],
    ["get", "/api/v1/stores/store-montclair/reports"],
    ["get", "/api/v1/audit"],
    ["post", "/api/v1/admin/users"],
    ["post", "/api/v1/chat"],
  ] as const)("%s %s requires a staff session (401)", async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("public search validates input before doing anything (400)", async () => {
    const res = await request(app).get("/api/v1/public/search");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("public search is reachable without an account and not yet implemented (501)", async () => {
    const res = await request(app).get("/api/v1/public/search").query({ q: "atorvastatin" });
    expect(res.status).toBe(501);
    expect(res.body.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("nearby search requires a ZIP or a consented location", async () => {
    const res = await request(app).get("/api/v1/public/nearby").query({ productId: "prod-amox" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
