/**
 * Background jobs (DDS §3: "Background worker: alerts/forecasts/notifications").
 * Jobs act under the WORKER service identity and call application services only;
 * they never write tables directly.
 */
import { AppError } from "../core/errors";
import type { Actor } from "../core/types";
import type { AppContext } from "../context";

export const WORKER_ACTOR: Actor = { kind: "SERVICE", serviceName: "WORKER" };

export interface JobOutcome {
  job: string;
  status: "OK" | "SKIPPED_NOT_IMPLEMENTED" | "FAILED";
  detail: string;
}

async function attempt(job: string, fn: () => unknown): Promise<JobOutcome> {
  try {
    const result = await fn();
    return { job, status: "OK", detail: JSON.stringify(result) };
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_IMPLEMENTED") {
      return { job, status: "SKIPPED_NOT_IMPLEMENTED", detail: err.message };
    }
    // A failing job must not crash the others (DDS M12: partial failure is flagged).
    return { job, status: "FAILED", detail: err instanceof Error ? err.message : String(err) };
  }
}

/** Run once per day per store (store-local date). Safe to re-run: alerts are idempotent per day (T15). */
export async function runDailyJobs(ctx: AppContext): Promise<JobOutcome[]> {
  const stores = ctx.db.prepare("SELECT id FROM stores WHERE active = 1").all() as { id: string }[];
  const outcomes: JobOutcome[] = [];

  for (const { id: storeId } of stores) {
    outcomes.push(
      await attempt(`expiry-alerts:${storeId}`, () =>
        ctx.dashboard.runDailyAlerts(storeId, ctx.expiration.todayForStore(storeId)),
      ),
    );
  }
  outcomes.push(await attempt("forecast-refresh", () => ctx.forecasting.refreshAll()));
  outcomes.push(await attempt("back-in-stock-notices", () => ctx.customers.sendBackInStock()));
  return outcomes;
}
