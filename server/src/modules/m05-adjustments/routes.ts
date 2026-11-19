import { Router } from "express";
import { z } from "zod";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission, requireStaff } from "../m01-identity/middleware";
import { ADJUSTMENT_REASON_CODES } from "./service";

const adjustmentBody = z.object({
  lotId: z.string().min(1),
  delta: z.number().int().refine((d) => d !== 0, "delta must not be zero"),
  reasonCode: z.enum(ADJUSTMENT_REASON_CODES),
  note: z.string().max(500).optional(),
});

/** DDS Appendix A: { "decision": "APPROVE", "expectedVersion": 3 } */
const reviewBody = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  expectedVersion: z.number().int().positive(),
});

const cycleCountBody = z.object({
  lotId: z.string().min(1),
  countedQty: z.number().int().min(0),
});

export function adjustmentsRouter(ctx: AppContext): Router {
  const r = Router();

  // Store scope is derived from the lot inside the service.
  r.post("/adjustments", requireStaff, (req, res) => {
    ok(req, res, ctx.adjustments.requestAdjustment(req.actor!, parse(adjustmentBody, req.body)), 201);
  });

  r.post("/adjustments/:id/approve", requireStaff, (req, res) => {
    ok(req, res, ctx.adjustments.reviewAdjustment(req.actor!, param(req, "id"), parse(reviewBody, req.body)));
  });

  r.post(
    "/stores/:storeId/cycle-counts",
    requirePermission("REQUEST_ADJUSTMENT", { storeParam: "storeId" }),
    (req, res) => {
      const body = parse(cycleCountBody, req.body);
      ok(req, res, ctx.adjustments.recordCycleCount(req.actor!, { ...body, storeId: param(req, "storeId") }));
    },
  );

  return r;
}
