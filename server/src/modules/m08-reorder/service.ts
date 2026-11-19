/**
 * M08 Reorder Rules and Suggestions (F13, F15, F17, F18)
 * Subparts: ThresholdEngine, SuggestionComposer
 * Tests: T10, T39, T41 (related T37) · Iteration 3
 *
 * ADVISORY ONLY (F18): this module may create recommendations and, after a
 * PHARMACIST_MANAGER accepts or edits one, a DRAFT order via M07. It never
 * changes stock and never approves or sends an order (T10).
 * Missing forecast -> fall back to the manual reorder_point (T66).
 */
import type { RecommendationKind, RecommendationStatus } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { OrderingService } from "../m07-ordering/service";
import type { ForecastingService } from "../m09-forecasting/service";
import type { AuditService } from "../m13-audit-reporting/service";

export interface RecommendationView {
  id: string;
  storeProductId: string;
  kind: RecommendationKind;
  suggestedQty: number | null;
  /** Human-readable explanation, required for every recommendation (F15). */
  reason: string;
  status: RecommendationStatus;
  modelVersion: string | null;
}

export type ReviewDecision =
  | { decision: "ACCEPT" }
  | { decision: "EDIT"; qty: number }
  | { decision: "REJECT" };

export class ReorderService {
  constructor(
    private readonly infra: Infra,
    private readonly forecasting: ForecastingService,
    private readonly ordering: OrderingService,
    private readonly audit: AuditService,
  ) {}

  /** DDS: evaluateReorder(storeProductId) -> Suggestion (PROPOSED), or null if above threshold. */
  evaluateReorder(actor: Actor, storeProductId: string): RecommendationView | null {
    throw notImplemented("M08 evaluate reorder");
  }

  listRecommendations(storeId: string): RecommendationView[] {
    throw notImplemented("M08 list recommendations");
  }

  /** DDS: reviewSuggestion(id, decision, qty) -> Result. */
  reviewSuggestion(actor: Actor, recommendationId: string, review: ReviewDecision): RecommendationView {
    throw notImplemented("M08 review suggestion");
  }
}
