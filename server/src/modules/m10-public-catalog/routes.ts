import { Router } from "express";
import { z } from "zod";
import { ok, parse } from "../../core/http";
import type { AppContext } from "../../context";

/** Bounded and sanitized input (DDS M10 preconditions). Rate limiting: TODO Iteration 5 (T55). */
const searchQuery = z.object({
  q: z.string().trim().min(2, "Enter at least 2 characters").max(100),
  storeId: z.string().optional(),
});

export function publicCatalogRouter(ctx: AppContext): Router {
  const r = Router();

  // Public: no account required (F2).
  r.get("/public/search", (req, res) => {
    ok(req, res, ctx.publicCatalog.searchProducts(parse(searchQuery, req.query)));
  });

  return r;
}
