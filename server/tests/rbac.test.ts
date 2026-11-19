import { describe, expect, it } from "vitest";
import type { Actor } from "../src/core/types";
import { authorize } from "../src/modules/m01-identity/rbac";

const technician: Actor = {
  kind: "USER",
  userId: "u-tech",
  email: "t@redhawk.test",
  roles: [{ role: "TECHNICIAN", storeId: "store-a" }],
};
const manager: Actor = {
  kind: "USER",
  userId: "u-mgr",
  email: "m@redhawk.test",
  roles: [{ role: "PHARMACIST_MANAGER", storeId: "store-a" }],
};
const admin: Actor = {
  kind: "USER",
  userId: "u-admin",
  email: "a@redhawk.test",
  roles: [{ role: "SYSTEM_ADMIN", storeId: null }],
};
const pos: Actor = { kind: "SERVICE", serviceName: "POS_ADAPTER" };

/** DDS §9.1 permission matrix, policy level. Endpoint-level tests come with each module. */
describe("RBAC policy (M01)", () => {
  it("anonymous callers are UNAUTHENTICATED", () => {
    expect(authorize(undefined, "VIEW_INVENTORY", "store-a")).toEqual({ allowed: false, reason: "UNAUTHENTICATED" });
  });

  it("technician can receive stock but cannot approve adjustments or orders (policy for T06, T22)", () => {
    expect(authorize(technician, "RECEIVE_STOCK", "store-a").allowed).toBe(true);
    expect(authorize(technician, "APPROVE_ADJUSTMENT", "store-a")).toEqual({ allowed: false, reason: "FORBIDDEN" });
    expect(authorize(technician, "APPROVE_ORDER", "store-a").allowed).toBe(false);
  });

  it("manager approves only in their own store (policy for T18)", () => {
    expect(authorize(manager, "APPROVE_ADJUSTMENT", "store-a").allowed).toBe(true);
    expect(authorize(manager, "APPROVE_ADJUSTMENT", "store-b")).toEqual({ allowed: false, reason: "FORBIDDEN" });
  });

  it("system admin manages users but does not approve by default", () => {
    expect(authorize(admin, "MANAGE_USERS", null).allowed).toBe(true);
    expect(authorize(admin, "VIEW_AUDIT", null).allowed).toBe(true);
    expect(authorize(admin, "APPROVE_ADJUSTMENT", "store-a").allowed).toBe(false);
    expect(authorize(admin, "APPROVE_ORDER", "store-a").allowed).toBe(false);
  });

  it("the POS service identity can only ingest sales", () => {
    expect(authorize(pos, "INGEST_POS_SALES", "store-a").allowed).toBe(true);
    expect(authorize(pos, "APPROVE_ADJUSTMENT", "store-a").allowed).toBe(false);
  });
});
