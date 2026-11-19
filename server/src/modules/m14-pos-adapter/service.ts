/**
 * M14 POS Integration Adapter (F6, F10)
 * Subparts: EventValidator, RetryQueue, POSMapper
 * Tests: T05, T17, T60 · Iteration 4
 *
 * - Verify the signature over the RAW body before parsing (adapters.posSignature); bad -> rejected + logged (T17).
 * - Each sale line becomes ledger.applySale(...) under the POS_ADAPTER service identity.
 *   sales_events.external_event_id is UNIQUE, so for multi-line events use
 *   `${externalEventId}:${lineNo}` per line.
 * - Replays return ALREADY_PROCESSED with the original result (exactly-once effect, T05).
 * - POS outage: the POS simulator queues and replays with the same IDs (T60, N7).
 */
import type { SaleResult } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Infra } from "../../context";
import type { StockLedgerService } from "../m04-stock-ledger/service";

export interface PosSaleEvent {
  externalEventId: string;
  soldAt: string;
  lines: { productId: string; qty: number }[];
}

export interface PosAcknowledgment {
  status: "ACCEPTED" | "ALREADY_PROCESSED";
  results: SaleResult[];
}

export class PosAdapterService {
  constructor(
    private readonly infra: Infra,
    private readonly ledger: StockLedgerService,
  ) {}

  /** DDS: ingestSale(externalId, payload) -> Acknowledgment. */
  ingestSale(storeId: string, event: PosSaleEvent, rawBody: string, signature: string | undefined): PosAcknowledgment {
    throw notImplemented("M14 POS sale ingestion");
  }
}
