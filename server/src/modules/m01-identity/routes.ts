import { Router } from "express";
import { z } from "zod";
import { ROLES } from "@pharma/shared";
import { ok, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission, requireStaff } from "./middleware";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

const createUserBody = z.object({
  email: z.string().email(),
  displayName: z.string().min(1),
  password: z.string().min(12),
  roles: z.array(z.object({ role: z.enum(ROLES), storeId: z.string().nullable() })).min(1),
});

export function identityRouter(ctx: AppContext): Router {
  const r = Router();

  r.post("/auth/login", (req, res) => {
    ok(req, res, ctx.identity.login(parse(loginBody, req.body)));
  });

  r.post("/auth/logout", requireStaff, (req, res) => {
    ctx.identity.logout(req.header("authorization")?.slice("Bearer ".length) ?? "");
    ok(req, res, { loggedOut: true });
  });

  r.get("/auth/me", requireStaff, (req, res) => {
    ok(req, res, ctx.identity.me(req.actor!));
  });

  r.post("/admin/users", requirePermission("MANAGE_USERS"), (req, res) => {
    ok(req, res, ctx.identity.createStaffUser(req.actor!, parse(createUserBody, req.body)), 201);
  });

  return r;
}
