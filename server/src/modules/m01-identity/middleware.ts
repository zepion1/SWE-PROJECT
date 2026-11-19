import type { RequestHandler } from "express";
import { errors } from "../../core/errors";
import type { AppContext } from "../../context";
import { assertAuthorized, type Action } from "./rbac";

/**
 * Resolve `Authorization: Bearer <token>` into `req.actor`. Requests without a
 * token continue anonymously; guards below decide whether that is allowed.
 */
export function authenticate(ctx: AppContext): RequestHandler {
  return (req, _res, next) => {
    const header = req.header("authorization");
    if (header?.startsWith("Bearer ")) {
      req.actor = ctx.identity.resolveSession(header.slice("Bearer ".length)) ?? undefined;
    }
    next();
  };
}

/** Any signed-in staff member. Use when the store is only known after a lookup (e.g. from a lot id). */
export const requireStaff: RequestHandler = (req, _res, next) => {
  if (req.actor?.kind !== "USER") return next(errors.unauthenticated());
  next();
};

/**
 * Route guard for an action. With `storeParam`, the store comes from the URL
 * (e.g. /stores/:storeId/...); otherwise it is a platform-wide check.
 * Services that act on a row (lot, order) must ALSO call assertAuthorized with
 * that row's store, because the URL alone cannot prove store scope.
 */
export function requirePermission(action: Action, options: { storeParam?: string } = {}): RequestHandler {
  return (req, _res, next) => {
    const raw = options.storeParam ? req.params[options.storeParam] : undefined;
    const storeId = typeof raw === "string" ? raw : null;
    assertAuthorized(req.actor, action, storeId);
    next();
  };
}
