import { Router } from "express";
import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@pharma/shared";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";

const inventoryQuery = z.object({
  q: z.string().max(100).optional(),
  productId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export function stockLedgerRouter(ctx: AppContext): Router {
  const r = Router();

  // Sales arrive through M14 (POST /stores/:storeId/sales-events), not here.
  r.get("/stores/:storeId/inventory", requirePermission("VIEW_INVENTORY", { storeParam: "storeId" }), (req, res) => {
    ok(req, res, ctx.ledger.listInventory(param(req, "storeId"), parse(inventoryQuery, req.query)));
  });

  return r;
}
