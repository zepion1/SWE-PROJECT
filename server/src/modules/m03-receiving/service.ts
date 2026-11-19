/**
 * M03 Stock Receiving and Lot Registry (F5, F7)
 * Subparts: ReceiptValidator, LotMatcher, ReceiptCommand
 * Tests: T01, T02, T27, T28 · Iteration 2
 *
 * Flow (ARCHITECTURE.md UC-01): check idempotency key -> validate -> M04.applyReceipt
 * - same key + same payload  -> return the original receipt, no second increase (T02)
 * - same key + other payload -> CONFLICT
 * - existing lot number with a different expiry -> CONFLICT "inconsistent lot" (T27)
 * - qty <= 0 -> VALIDATION_ERROR; already-expired lot -> QUARANTINED, never sellable (T28)
 */
import type { ReceiptResult } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { StockLedgerService } from "../m04-stock-ledger/service";

export interface ReceiveStockInput {
  storeId: string;
  productId: string;
  supplierId: string;
  lotNumber: string;
  /** Store-local calendar date, YYYY-MM-DD. */
  expiresOn: string;
  quantity: number;
  /** Raw scanned barcode, when received by scan rather than manual entry. */
  barcode?: string;
}

export class ReceivingService {
  constructor(
    private readonly infra: Infra,
    private readonly ledger: StockLedgerService,
  ) {}

  /** DDS: receiveStock(storeId, productId, lot, expiry, qty, supplier, idempotencyKey) -> Receipt */
  receiveStock(actor: Actor, input: ReceiveStockInput, idempotencyKey: string): ReceiptResult {
    throw notImplemented("M03 receive stock");
  }
}
