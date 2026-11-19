/**
 * M04 Stock Ledger and Sales (F3, F6, F7, F10)
 * Subparts: LotSelector, StockTransaction, IdempotencyGuard
 * Tests: T03, T04, T05, T16, T63, T64 · Iteration 2
 *
 * THE SOLE WRITER of lots.qty_on_hand. Every method that changes stock must:
 *   1. run inside ONE db.transaction(...) (better-sqlite3 transactions are serializable)
 *   2. append a stock_movements row per lot touched (never update/delete one)
 *   3. call audit.record(...) inside the same transaction (fail closed, T16)
 *   4. bump lots.version (optimistic concurrency for M05 adjustments)
 * Sales allocate first-expired-first-out across sellable lots (expiration.isSellable)
 * and replay by external_event_id (see Appendix B.1 / ARCHITECTURE.md UC-02).
 */
import type { MovementType, SaleResult, StockView } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { ExpirationService } from "../m06-expiration/service";
import type { AuditService } from "../m13-audit-reporting/service";

export interface SaleInput {
  storeId: string;
  productId: string;
  qty: number;
  externalEventId: string;
  soldAt: string;
}

export interface ReceiptMovementInput {
  storeId: string;
  productId: string;
  supplierId: string;
  lotNumber: string;
  expiresOn: string;
  qty: number;
}

export interface LotDeltaInput {
  lotId: string;
  delta: number;
  type: Extract<MovementType, "ADJUSTMENT" | "DISPOSAL" | "RETURN">;
  reason: string;
  /** Lot version the caller saw; mismatch -> CONFLICT (stale count). */
  expectedVersion?: number;
}

export interface InventoryFilter {
  q?: string;
  productId?: string;
  limit: number;
}

export class StockLedgerService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
    private readonly expiration: ExpirationService,
  ) {}

  /** DDS: applySale(storeId, productId, qty, eventId) -> SaleResult. Errors: INSUFFICIENT_STOCK, EXPIRED_LOT. */
  applySale(actor: Actor, input: SaleInput): SaleResult {
    throw notImplemented("M04 apply sale");
  }

  /** Called by M03. Creates or tops up a lot; returns the lot id. */
  applyReceipt(actor: Actor, input: ReceiptMovementInput): { lotId: string; movementId: string } {
    throw notImplemented("M04 apply receipt");
  }

  /** Called by M05 (approved adjustments) and M06 (disposals/returns). Never lets a lot go negative. */
  applyLotDelta(actor: Actor, input: LotDeltaInput): { movementId: string; qtyOnHand: number } {
    throw notImplemented("M04 apply lot delta");
  }

  /** DDS: getStock(productId, storeId) -> StockView, broken down by lot (F7). */
  getStock(storeId: string, productId: string): StockView {
    throw notImplemented("M04 get stock");
  }

  listInventory(storeId: string, filter: InventoryFilter): StockView[] {
    throw notImplemented("M04 list inventory");
  }
}
