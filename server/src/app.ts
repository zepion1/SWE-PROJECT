import express, { Router, type Express, type Request } from "express";
import { API_PREFIX, type HealthStatus } from "@pharma/shared";
import type { AppContext } from "./context";
import { errorHandler, notFoundHandler, ok, requestId } from "./core/http";
import "./core/types";
import { identityRouter } from "./modules/m01-identity/routes";
import { authenticate } from "./modules/m01-identity/middleware";
import { catalogRouter } from "./modules/m02-catalog/routes";
import { receivingRouter } from "./modules/m03-receiving/routes";
import { stockLedgerRouter } from "./modules/m04-stock-ledger/routes";
import { adjustmentsRouter } from "./modules/m05-adjustments/routes";
import { expirationRouter } from "./modules/m06-expiration/routes";
import { orderingRouter } from "./modules/m07-ordering/routes";
import { reorderRouter } from "./modules/m08-reorder/routes";
import { forecastingRouter } from "./modules/m09-forecasting/routes";
import { publicCatalogRouter } from "./modules/m10-public-catalog/routes";
import { proximityRouter } from "./modules/m11-proximity/routes";
import { dashboardRouter } from "./modules/m12-dashboard/routes";
import { auditRouter } from "./modules/m13-audit-reporting/routes";
import { posRouter } from "./modules/m14-pos-adapter/routes";
import { customersRouter } from "./modules/m15-customers/routes";
import { chatRouter } from "./modules/m16-ai-chat/routes";

export const APP_VERSION = "0.1.0";

/** Build the Express app. Takes the context so tests can inject an in-memory DB, fixed clock and stubs. */
export function createApp(ctx: AppContext): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(
    express.json({
      limit: "100kb",
      verify: (req, _res, buf) => {
        (req as Request).rawBody = buf.toString("utf8");
      },
    }),
  );
  app.use(API_PREFIX, apiRouter(ctx));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

function apiRouter(ctx: AppContext): Router {
  const api = Router();
  api.use(authenticate(ctx));

  api.get("/health", (req, res) => {
    let db: HealthStatus["db"] = "ok";
    try {
      ctx.db.prepare("SELECT 1").get();
    } catch {
      db = "error";
    }
    const body: HealthStatus = { status: "ok", db, version: APP_VERSION, time: ctx.clock.now().toISOString() };
    ok(req, res, body);
  });

  // One router per DDS module (ARCHITECTURE.md "API surface").
  api.use(identityRouter(ctx)); // M01
  api.use(catalogRouter(ctx)); // M02
  api.use(receivingRouter(ctx)); // M03
  api.use(stockLedgerRouter(ctx)); // M04
  api.use(adjustmentsRouter(ctx)); // M05
  api.use(expirationRouter(ctx)); // M06
  api.use(orderingRouter(ctx)); // M07
  api.use(reorderRouter(ctx)); // M08
  api.use(forecastingRouter(ctx)); // M09
  api.use(publicCatalogRouter(ctx)); // M10
  api.use(proximityRouter(ctx)); // M11
  api.use(dashboardRouter(ctx)); // M12
  api.use(auditRouter(ctx)); // M13
  api.use(posRouter(ctx)); // M14
  api.use(customersRouter(ctx)); // M15
  api.use(chatRouter(ctx)); // M16
  return api;
}
