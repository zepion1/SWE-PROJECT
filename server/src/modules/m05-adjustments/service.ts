/**
 * M05 Adjustments and Cycle Counts (F6, F8)
 * Subparts: CountComparison, AdjustmentStateMachine
 * Tests: T06, T07, T29, T31 · Iteration 2
 *
 * - Technicians and managers may REQUEST; only PHARMACIST_MANAGER for the lot's
 *   store may APPROVE/REJECT (assertAuthorized with the lot's storeId).
 * - Transitions follow ADJUSTMENT_TRANSITIONS (@pharma/shared); anything else -> CONFLICT (T29).
 * - Self-approval is rejected (Q4 default; change here if the team decides otherwise).
 * - Stale lot version -> CONFLICT "recount required".
 * - Approval applies the delta exactly once via ledger.applyLotDelta (T07).
 */
import type { AdjustmentStatus } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { StockLedgerService } from "../m04-stock-ledger/service";
import type { AuditService } from "../m13-audit-reporting/service";

export const ALLOW_SELF_APPROVAL = false; // Q4

export const ADJUSTMENT_REASON_CODES = ["DAMAGED", "MISCOUNT", "THEFT_LOSS", "FOUND", "DATA_ENTRY_ERROR", "OTHER"] as const;
export type AdjustmentReasonCode = (typeof ADJUSTMENT_REASON_CODES)[number];

export interface AdjustmentView {
  id: string;
  lotId: string;
  requestedDelta: number;
  reasonCode: AdjustmentReasonCode;
  status: AdjustmentStatus;
  requestedBy: string;
  reviewedBy: string | null;
}

export class AdjustmentService {
  constructor(
    private readonly infra: Infra,
    private readonly ledger: StockLedgerService,
    private readonly audit: AuditService,
  ) {}

  /** DDS: requestAdjustment(lot, delta, reason) -> Request (PENDING; stock unchanged). */
  requestAdjustment(
    actor: Actor,
    input: { lotId: string; delta: number; reasonCode: AdjustmentReasonCode; note?: string },
  ): AdjustmentView {
    throw notImplemented("M05 request adjustment");
  }

  /** DDS: approveAdjustment(id, reviewer) -> Result. */
  reviewAdjustment(
    actor: Actor,
    adjustmentId: string,
    input: { decision: "APPROVE" | "REJECT"; expectedVersion: number },
  ): AdjustmentView {
    throw notImplemented("M05 review adjustment");
  }

  /** F8: compare a counted quantity with the record; a difference creates a PENDING request (T31). */
  recordCycleCount(
    actor: Actor,
    input: { storeId: string; lotId: string; countedQty: number },
  ): { flagged: boolean; adjustment: AdjustmentView | null } {
    throw notImplemented("M05 cycle count");
  }
}
