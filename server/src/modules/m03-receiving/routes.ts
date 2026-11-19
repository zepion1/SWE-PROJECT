import { Router } from "express";
import { z } from "zod";
import { errors } from "../../core/errors";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";

/** Body shape from DDS Appendix A. */
const receiptBody = z.object({
  productId: z.string().min(1),
  supplierId: z.string().min(1),
  lotNumber: z.string().min(1).max(64),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD"),
  quantity: z.number().int().positive(),
  barcode: z.string().max(128).optional(),
});

export function receivingRouter(ctx: AppContext): Router {
  const r = Router();

  r.post("/stores/:storeId/receipts", requirePermission("RECEIVE_STOCK", { storeParam: "storeId" }), (req, res) => {
    const idempotencyKey = req.header("idempotency-key");
    if (!idempotencyKey) throw errors.validation("Idempotency-Key header is required");
    const body = parse(receiptBody, req.body);
    ok(req, res, ctx.receiving.receiveStock(req.actor!, { ...body, storeId: param(req, "storeId") }, idempotencyKey), 201);
  });

  return r;
}
