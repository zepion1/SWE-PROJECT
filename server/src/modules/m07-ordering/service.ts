/**
 * M07 Suppliers and Purchase Orders (F12, F13, F14)
 * Subparts: SupplierRepository, OrderStateMachine, SupplierAdapter
 * Tests: T09, T19, T36, T38, T65 · Iteration 3
 *
 * - Transitions follow PURCHASE_ORDER_TRANSITIONS (@pharma/shared); others -> CONFLICT (T38).
 * - Only APPROVED orders are sent (T09); approval requires PHARMACIST_MANAGER for the order's store.
 * - sendOrder uses adapters.supplier with idempotencyKey = order id, so a retry never
 *   double-dispatches (T65); a failure leaves the order APPROVED for retry.
 * - Receiving against an order records stock through M03/M04 and flags short/over deliveries (T19).
 */
import type { PurchaseOrderView } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { AuditService } from "../m13-audit-reporting/service";

export interface SupplierInput {
  name: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  leadDays: number;
  minimumOrderCents: number;
}

export interface SupplierView extends SupplierInput {
  id: string;
  active: boolean;
}

export interface DraftOrderInput {
  storeId: string;
  supplierId: string;
  lines: { productId: string; qty: number; unitPriceCents: number }[];
  sourceRecommendationId?: string;
}

export interface OrderReceiptInput {
  lines: { productId: string; receivedQty: number; lotNumber: string; expiresOn: string }[];
}

export class OrderingService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
  ) {}

  listSuppliers(): SupplierView[] {
    throw notImplemented("M07 list suppliers");
  }

  /** F12: negative lead time -> VALIDATION_ERROR (T36). */
  createSupplier(actor: Actor, input: SupplierInput): SupplierView {
    throw notImplemented("M07 create supplier");
  }

  /** DDS: draftOrder(lines) -> Order (DRAFT). Also called by M08 after an accepted recommendation. */
  draftOrder(actor: Actor, input: DraftOrderInput): PurchaseOrderView {
    throw notImplemented("M07 draft order");
  }

  /** DDS: approveOrder(id, user) -> Order. */
  approveOrder(actor: Actor, orderId: string): PurchaseOrderView {
    throw notImplemented("M07 approve order");
  }

  /** DDS: sendOrder(id) -> DeliveryStatus. */
  async sendOrder(actor: Actor, orderId: string): Promise<PurchaseOrderView> {
    throw notImplemented("M07 send order");
  }

  receiveOrder(actor: Actor, orderId: string, input: OrderReceiptInput): PurchaseOrderView {
    throw notImplemented("M07 receive order");
  }
}
