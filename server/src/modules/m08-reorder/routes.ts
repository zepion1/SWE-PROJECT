import { Router } from "express";
import { z } from "zod";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission, requireStaff } from "../m01-identity/middleware";

const reviewBody = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("ACCEPT") }),
  z.object({ decision: z.literal("EDIT"), qty: z.number().int().min(0) }),
  z.object({ decision: z.literal("REJECT") }),
]);

export function reorderRouter(ctx: AppContext): Router {
  const r = Router();

  r.get(
    "/stores/:storeId/recommendations",
    requirePermission("VIEW_FORECASTS", { storeParam: "storeId" }),
    (req, res) => {
      ok(req, res, ctx.reorder.listRecommendations(param(req, "storeId")));
    },
  );

  // REVIEW_RECOMMENDATIONS is checked in the service against the recommendation's store.
  r.post("/recommendations/:id/review", requireStaff, (req, res) => {
    ok(req, res, ctx.reorder.reviewSuggestion(req.actor!, param(req, "id"), parse(reviewBody, req.body)));
  });

  return r;
}
