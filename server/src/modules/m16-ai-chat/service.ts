/**
 * M16 AI Chat Interface (F15, F18)
 * Subparts: IntentRouter, ReadOnlyToolGateway, Guardrail
 * Tests: T42 · Iteration 6 (E2 prototype)
 *
 * GUARDRAILS:
 * - Read-only: may only call read methods of M08/M09 (forecasts, recommendations).
 * - A request to act ("place an order") becomes a proposedAction for human review,
 *   never an executed command (F18).
 * - Medical or dosing questions are refused (SRS §1.2 out of scope).
 * - Answers cite the internal facts they used; missing data is stated, not invented.
 */
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { ReorderService } from "../m08-reorder/service";
import type { ForecastingService } from "../m09-forecasting/service";

export interface ChatAnswer {
  answer: string;
  citations: { type: "forecast" | "recommendation" | "inventory"; id: string }[];
  refused: boolean;
  proposedAction: { type: "REVIEW_REORDER"; storeProductId: string } | null;
  disclaimer: string;
}

export class ChatService {
  constructor(
    private readonly infra: Infra,
    private readonly forecasting: ForecastingService,
    private readonly reorder: ReorderService,
  ) {}

  /** DDS: answer(question, context) -> Answer. */
  async answer(actor: Actor, input: { storeId: string; question: string }): Promise<ChatAnswer> {
    throw notImplemented("M16 AI chat");
  }
}
