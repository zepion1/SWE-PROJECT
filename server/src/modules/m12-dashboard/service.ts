/**
 * M12 Dashboard and Alerts (F9, F10, F13, F24)
 * Subparts: DashboardQuery, AlertPublisher
 * Tests: T15, T33, T48 · Iteration 3
 *
 * - Dashboard reflects committed state only; if analytics (forecasts) fail,
 *   set analyticsUnavailable = true but STILL return inventory panels (T48).
 * - runDailyAlerts upserts into `alerts` (UNIQUE per store/type/resource/day), so
 *   running it twice on the same day creates no duplicates (T15). Alerts go to
 *   that store's Pharmacist/Manager and Technician only (T33).
 */
import type { DashboardSummary } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { ExpirationService } from "../m06-expiration/service";

export class DashboardService {
  constructor(
    private readonly infra: Infra,
    private readonly expiration: ExpirationService,
  ) {}

  /** DDS: getDashboard(storeId) -> DashboardDTO. */
  getDashboard(actor: Actor, storeId: string): DashboardSummary {
    throw notImplemented("M12 dashboard");
  }

  /** DDS: runDailyAlerts(storeId, date) -> Summary. `date` is the store-local date. */
  runDailyAlerts(storeId: string, date: string): { created: number; existing: number } {
    throw notImplemented("M12 daily alerts");
  }
}
