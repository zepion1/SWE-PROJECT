import { Router } from "express";
import { z } from "zod";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission, requireStaff } from "../m01-identity/middleware";

const supplierBody = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  leadDays: z.number().int().min(0),
  minimumOrderCents: z.number().int().min(0),
});

const orderBody = z.object({
  storeId: z.string().min(1),
  supplierId: z.string().min(1),
  lines: z
    .array(z.object({ productId: z.string().min(1), qty: z.number().int().positive(), unitPriceCents: z.number().int().min(0) }))
    .min(1),
});

const orderReceiptBody = z.object({
  lines: z
    .array(
      z.object({
        productId: z.string().min(1),
        receivedQty: z.number().int().min(0),
        lotNumber: z.string().min(1),
        expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
    )
    .min(1),
});

export function orderingRouter(ctx: AppContext): Router {
  const r = Router();

  r.get("/suppliers", requireStaff, (req, res) => {
    ok(req, res, ctx.ordering.listSuppliers());
  });

  r.post("/suppliers", requirePermission("MANAGE_SUPPLIERS"), (req, res) => {
    ok(req, res, ctx.ordering.createSupplier(req.actor!, parse(supplierBody, req.body)), 201);
  });

  // Store scope for order operations is checked in the service against the order's store.
  r.post("/orders", requireStaff, (req, res) => {
    ok(req, res, ctx.ordering.draftOrder(req.actor!, parse(orderBody, req.body)), 201);
  });

  r.post("/orders/:id/approve", requireStaff, (req, res) => {
    ok(req, res, ctx.ordering.approveOrder(req.actor!, param(req, "id")));
  });

  r.post("/orders/:id/send", requireStaff, async (req, res) => {
    ok(req, res, await ctx.ordering.sendOrder(req.actor!, param(req, "id")));
  });

  r.post("/orders/:id/receipts", requireStaff, (req, res) => {
    ok(req, res, ctx.ordering.receiveOrder(req.actor!, param(req, "id"), parse(orderReceiptBody, req.body)));
  });

  return r;
}
