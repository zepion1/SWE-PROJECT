/**
 * M09 Sales History and Forecasting (F16, F17)
 * Subparts: HistoryAggregator, ForecastAdapter, BaselineModel
 * Tests: T11, T40, T61, T66 · Iteration 4
 *
 * READ-ONLY with respect to inventory and orders: it reads sales_events and
 * writes only to the forecasts table. Start with a transparent baseline
 * (e.g. seasonal moving average) and replace it only for a measured MAPE gain (N8).
 * No history -> labelled insufficient-data/baseline result (T11).
 */
import type { ForecastHorizon, ForecastView } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Infra } from "../../context";

export const BASELINE_MODEL_VERSION = "baseline-0";

export class ForecastingService {
  constructor(private readonly infra: Infra) {}

  /** DDS: forecast(storeProductId, horizon) -> ForecastResult. */
  forecast(storeProductId: string, horizon: ForecastHorizon): ForecastView {
    throw notImplemented("M09 forecast");
  }

  /** Recompute forecasts for every active listing (called by the worker). */
  refreshAll(): { generated: number } {
    throw notImplemented("M09 refresh forecasts");
  }
}
