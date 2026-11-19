import { Router } from "express";
import { z } from "zod";
import { ok, parse } from "../../core/http";
import type { AppContext } from "../../context";
import type { Origin } from "./service";

const nearbyQuery = z
  .object({
    productId: z.string().min(1),
    zip: z.string().regex(/^\d{5}$/, "ZIP must be 5 digits").optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((q) => q.zip !== undefined || (q.lat !== undefined && q.lng !== undefined), {
    message: "Provide a ZIP code or a consented device location (lat and lng)",
  });

export function proximityRouter(ctx: AppContext): Router {
  const r = Router();

  // Location data stays in this handler's memory: do not log req.query here (T57).
  r.get("/public/nearby", async (req, res) => {
    const q = parse(nearbyQuery, req.query);
    const origin: Origin = q.zip !== undefined ? { zip: q.zip } : { lat: q.lat!, lng: q.lng! };
    ok(req, res, await ctx.proximity.nearby(q.productId, origin));
  });

  return r;
}
