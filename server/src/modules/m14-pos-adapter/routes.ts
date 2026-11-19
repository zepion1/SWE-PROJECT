import { Router } from "express";
import { z } from "zod";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";

const saleEventBody = z.object({
  externalEventId: z.string().min(1).max(128),
  soldAt: z.string().datetime({ offset: true }),
  lines: z.array(z.object({ productId: z.string().min(1), qty: z.number().int().positive() })).min(1),
});

export function posRouter(ctx: AppContext): Router {
  const r = Router();

  // Authenticated by POS signature (X-POS-Signature), not by a staff session.
  r.post("/stores/:storeId/sales-events", (req, res) => {
    const event = parse(saleEventBody, req.body);
    ok(req, res, ctx.pos.ingestSale(param(req, "storeId"), event, req.rawBody ?? "", req.header("x-pos-signature")));
  });

  return r;
}
