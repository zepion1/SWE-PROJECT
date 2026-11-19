import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { errors } from "../../core/errors";
import { ok, param, parse } from "../../core/http";
import type { AppContext } from "../../context";

const registerBody = z.object({ email: z.string().email(), password: z.string().min(12) });
const subscribeBody = z.object({ storeProductId: z.string().min(1) });

/**
 * Customer sessions are separate from staff sessions.
 * TODO (Iteration 5, M15): resolve a customer session and set the customer id.
 * Until then every customer-only route fails closed with 401.
 */
const requireCustomer: RequestHandler = (_req, _res, next) => {
  next(errors.unauthenticated("Customer sign-in required"));
};

export function customersRouter(ctx: AppContext): Router {
  const r = Router();

  r.post("/public/customers", (req, res) => {
    ok(req, res, ctx.customers.registerCustomer(parse(registerBody, req.body)), 201);
  });

  r.post("/public/subscriptions", requireCustomer, (req, res) => {
    const { storeProductId } = parse(subscribeBody, req.body);
    ok(req, res, ctx.customers.subscribe("TODO-customer-id", storeProductId), 201);
  });

  r.delete("/public/subscriptions/:id", requireCustomer, (req, res) => {
    ok(req, res, ctx.customers.unsubscribe("TODO-customer-id", param(req, "id")));
  });

  return r;
}
