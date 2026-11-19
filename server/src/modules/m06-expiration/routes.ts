import { Router } from "express";
import { z } from "zod";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";

const expiringQuery = z.object({
  days: z.coerce
    .number()
    .refine((d): d is 30 | 60 | 90 => d === 30 || d === 60 || d === 90, "days must be 30, 60 or 90")
    .default(30),
});

const disposalBody = z.object({
  lotId: z.string().min(1),
  qty: z.number().int().positive(),
  type: z.enum(["DISPOSAL", "RETURN"]),
  reason: z.string().min(1).max(500),
});

export function expirationRouter(ctx: AppContext): Router {
  const r = Router();

  r.get("/stores/:storeId/expiring", requirePermission("VIEW_EXPIRING", { storeParam: "storeId" }), (req, res) => {
    const { days } = parse(expiringQuery, req.query);
    ok(req, res, ctx.expiration.listExpiring(param(req, "storeId"), days as 30 | 60 | 90));
  });

  r.post("/stores/:storeId/disposals", requirePermission("RECORD_DISPOSAL", { storeParam: "storeId" }), (req, res) => {
    const body = parse(disposalBody, req.body);
    ok(req, res, ctx.expiration.recordDisposal(req.actor!, { ...body, storeId: param(req, "storeId") }), 201);
  });

  return r;
}
