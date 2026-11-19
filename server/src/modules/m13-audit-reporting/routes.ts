import { Router } from "express";
import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from "@pharma/shared";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";
import { REPORT_TYPES } from "./service";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const reportQuery = z.object({ type: z.enum(REPORT_TYPES), from: isoDate, to: isoDate });

const auditQuery = z.object({
  storeId: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
});

export function auditRouter(ctx: AppContext): Router {
  const r = Router();

  r.get("/stores/:storeId/reports", requirePermission("EXPORT_REPORTS", { storeParam: "storeId" }), (req, res) => {
    const csv = ctx.audit.exportReport(req.actor!, param(req, "storeId"), parse(reportQuery, req.query));
    res.type("text/csv").setHeader("X-Request-Id", req.requestId).send(csv);
  });

  r.get("/audit", requirePermission("VIEW_AUDIT"), (req, res) => {
    ok(req, res, ctx.audit.list(req.actor!, parse(auditQuery, req.query)));
  });

  return r;
}
