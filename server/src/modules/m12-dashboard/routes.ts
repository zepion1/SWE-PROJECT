import { Router } from "express";
import { ok, param } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";

export function dashboardRouter(ctx: AppContext): Router {
  const r = Router();

  r.get("/stores/:storeId/dashboard", requirePermission("VIEW_DASHBOARD", { storeParam: "storeId" }), (req, res) => {
    ok(req, res, ctx.dashboard.getDashboard(req.actor!, param(req, "storeId")));
  });

  return r;
}
