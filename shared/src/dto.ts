/**
 * Data transfer objects for the /api/v1 contracts (DDS §8, Appendix A).
 * Public DTOs intentionally have NO quantity fields (F19, T13).
 */
import type {
  AlertType,
  ExpiryBucket,
  ForecastHorizon,
  LotStatus,
  PublicAvailabilityLabel,
  PurchaseOrderStatus,
  Role,
  ScheduleClass,
} from "./domain";

// ---- Staff ---------------------------------------------------------------

export interface ActorView {
  userId: string;
  email: string;
  displayName: string;
  roles: { role: Role; storeId: string | null }[];
}

export interface ProductView {
  id: string;
  ndc: string;
  brandName: string | null;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  scheduleClass: ScheduleClass;
  active: boolean;
}

export interface LotView {
  lotId: string;
  lotNumber: string;
  supplierId: string;
  expiresOn: string;
  qtyOnHand: number;
  status: LotStatus;
  expiryBucket: ExpiryBucket | null;
}

export interface StockView {
  storeId: string;
  productId: string;
  sellableQty: number;
  lots: LotView[];
  asOf: string;
}

export interface ReceiptResult {
  receiptId: string;
  lotId: string;
  acceptedQuantity: number;
}

export interface SaleResult {
  externalEventId: string;
  allocations: { lotId: string; qty: number }[];
  replayed: boolean;
}

export interface PurchaseOrderView {
  id: string;
  storeId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: { productId: string; qty: number; unitPriceCents: number; receivedQty: number }[];
}

export interface ForecastView {
  storeProductId: string;
  horizonDays: ForecastHorizon;
  predictedUnits: number;
  modelVersion: string;
  insufficientData: boolean;
  generatedAt: string;
}

export interface DashboardSummary {
  storeId: string;
  lowStock: { productId: string; name: string }[];
  expiring: { lotId: string; productName: string; bucket: ExpiryBucket }[];
  pendingOrders: { orderId: string; status: PurchaseOrderStatus }[];
  aiAlerts: { alertId: string; type: AlertType; message: string }[];
  /** Set when analytics failed; inventory panels still show (T48). */
  analyticsUnavailable: boolean;
  asOf: string;
}

// ---- Public (customer portal) ------------------------------------------------

export interface PublicProductResult {
  productId: string;
  name: string;
  genericName: string;
  strength: string;
  dosageForm: string;
  /** Display label from PUBLIC_AVAILABILITY. Never an exact count. */
  availability: PublicAvailabilityLabel;
  /** Cash price as a decimal string, e.g. "12.99" (F20). */
  cashPrice: string;
  pricingNote: string;
  genericAlternatives: { productId: string; name: string }[];
}

export interface NearbyPharmacy {
  storeId: string;
  name: string;
  address: string;
  distanceMiles: number;
  directionsUrl: string | null;
}
