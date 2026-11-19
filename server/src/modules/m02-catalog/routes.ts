import { Router } from "express";
import { z } from "zod";
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX, SCHEDULE_CLASSES } from "@pharma/shared";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";
import { requirePermission } from "../m01-identity/middleware";

/** NDC stays a string: digits with optional hyphens, 10 or 11 digits total. */
const ndc = z
  .string()
  .regex(/^[0-9-]+$/, "NDC may contain digits and hyphens only")
  .refine((v) => [10, 11].includes(v.replace(/-/g, "").length), "NDC must have 10 or 11 digits");

const productBody = z.object({
  ndc,
  brandName: z.string().min(1).nullable(),
  genericName: z.string().min(1),
  strength: z.string().min(1),
  dosageForm: z.string().min(1),
  category: z.string().min(1),
  scheduleClass: z.enum(SCHEDULE_CLASSES),
});

const productPatch = productBody.partial().extend({ active: z.boolean().optional() });

const productQuery = z.object({
  q: z.string().max(100).optional(),
  includeInactive: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  cursor: z.string().optional(),
});

export function catalogRouter(ctx: AppContext): Router {
  const r = Router();

  r.get("/products", requirePermission("VIEW_PRODUCTS"), (req, res) => {
    ok(req, res, ctx.catalog.lookup(parse(productQuery, req.query)));
  });

  r.post("/products", requirePermission("MANAGE_PRODUCTS"), (req, res) => {
    ok(req, res, ctx.catalog.createProduct(req.actor!, parse(productBody, req.body)), 201);
  });

  r.patch("/products/:id", requirePermission("MANAGE_PRODUCTS"), (req, res) => {
    ok(req, res, ctx.catalog.updateProduct(req.actor!, param(req, "id"), parse(productPatch, req.body)));
  });

  return r;
}
