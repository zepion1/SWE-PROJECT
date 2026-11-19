import { Router } from "express";
import { z } from "zod";
import type { ForecastHorizon } from "@pharma/shared";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requireStaff } from "../m01-identity/middleware";

/** Allowed horizons: 7, 30, 90 days. Anything else (e.g. 45) -> VALIDATION_ERROR (T40). */
const forecastQuery = z.object({
  days: z.coerce
    .number()
    .refine((d) => d === 7 || d === 30 || d === 90, "days must be 7, 30 or 90")
    .default(30),
});

export function forecastingRouter(ctx: AppContext): Router {
  const r = Router();

  // VIEW_FORECASTS is checked in the service against the listing's store.
  r.get("/forecast/:storeProductId", requireStaff, (req, res) => {
    const { days } = parse(forecastQuery, req.query);
    ok(req, res, ctx.forecasting.forecast(param(req, "storeProductId"), days as ForecastHorizon));
  });

  return r;
}
