import request from "supertest";
import { describe, expect, it } from "vitest";
import { createTestApp, TEST_NOW } from "./helpers";

describe("API envelope and health", () => {
  const { app } = createTestApp();

  it("GET /api/v1/health returns the success envelope", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ok", db: "ok", time: TEST_NOW });
    expect(res.body.requestId).toEqual(expect.any(String));
    expect(res.headers["x-request-id"]).toBe(res.body.requestId);
  });

  it("echoes an incoming X-Request-Id", async () => {
    const res = await request(app).get("/api/v1/health").set("X-Request-Id", "req-21");
    expect(res.body.requestId).toBe("req-21");
  });

  it("unknown routes return NOT_FOUND in the error envelope", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: expect.any(String) },
      requestId: expect.any(String),
    });
  });

  it("malformed JSON returns VALIDATION_ERROR, not a stack trace", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("at ");
  });
});
