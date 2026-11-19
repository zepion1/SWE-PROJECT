/**
 * Domain vocabulary shared by client and server. Values match the CHECK
 * constraints in server/src/db/migrations/001_initial.sql.
 */

// ---- Roles (SRS Table 2.1.1, DDS §9.1) -------------------------------------
export const ROLES = ["PHARMACIST_MANAGER", "TECHNICIAN", "SYSTEM_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

// ---- Catalog ---------------------------------------------------------------
export const SCHEDULE_CLASSES = ["NONE", "I", "II", "III", "IV", "V"] as const;
export type ScheduleClass = (typeof SCHEDULE_CLASSES)[number];

// ---- Lots and the stock ledger ----------------------------------------------
export const LOT_STATUSES = ["ACTIVE", "QUARANTINED", "DEPLETED", "EXPIRED"] as const;
export type LotStatus = (typeof LOT_STATUSES)[number];

export const MOVEMENT_TYPES = ["RECEIPT", "SALE", "ADJUSTMENT", "DISPOSAL", "RETURN"] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// ---- Expiration (F9) -------------------------------------------------------
export const EXPIRY_WINDOWS = [30, 60, 90] as const;
export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number];
export type ExpiryBucket = "EXPIRED" | "WITHIN_30" | "WITHIN_60" | "WITHIN_90";

// ---- Forecasting (F16) -----------------------------------------------------
export const FORECAST_HORIZONS = [7, 30, 90] as const;
export type ForecastHorizon = (typeof FORECAST_HORIZONS)[number];

// ---- Public availability (F19, F22) ----------------------------------------
export const PUBLIC_AVAILABILITY = {
  IN_STOCK: "In Stock",
  LOW_STOCK: "Low Stock",
  OUT_OF_STOCK: "Out of Stock",
  CONTACT_PHARMACY: "Contact pharmacy for availability",
} as const;
export type PublicAvailability = keyof typeof PUBLIC_AVAILABILITY;
export type PublicAvailabilityLabel = (typeof PUBLIC_AVAILABILITY)[PublicAvailability];

export const INSURANCE_PRICING_NOTE = "Insurance pricing may differ";

// ---- Alerts (F10, F13, F24) ------------------------------------------------
export const ALERT_TYPES = [
  "EXPIRED",
  "EXPIRING_30",
  "EXPIRING_60",
  "EXPIRING_90",
  "LOW_STOCK",
  "REORDER",
  "AI_RECOMMENDATION",
] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

// ---- State machines (DDS §7.1) ---------------------------------------------
// Anything not listed is a disallowed transition and must return CONFLICT.

export const ADJUSTMENT_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];
export const ADJUSTMENT_TRANSITIONS: Record<AdjustmentStatus, readonly AdjustmentStatus[]> = {
  PENDING: ["APPROVED", "REJECTED"],
  APPROVED: [],
  REJECTED: [],
};

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "APPROVED",
  "SENT",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELED",
] as const;
export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];
export const PURCHASE_ORDER_TRANSITIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]> = {
  DRAFT: ["APPROVED", "CANCELED"],
  APPROVED: ["SENT"],
  SENT: ["PARTIALLY_RECEIVED", "RECEIVED"],
  PARTIALLY_RECEIVED: ["RECEIVED"],
  RECEIVED: [],
  CANCELED: [],
};

export const RECOMMENDATION_KINDS = ["REORDER", "EXPIRY_RISK", "UNUSUAL_ACTIVITY"] as const;
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number];
export const RECOMMENDATION_STATUSES = ["PROPOSED", "ACCEPTED", "EDITED", "REJECTED"] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];
export const RECOMMENDATION_TRANSITIONS: Record<RecommendationStatus, readonly RecommendationStatus[]> = {
  PROPOSED: ["ACCEPTED", "EDITED", "REJECTED"],
  ACCEPTED: [],
  EDITED: [],
  REJECTED: [],
};

export const LOT_TRANSITIONS: Record<LotStatus, readonly LotStatus[]> = {
  ACTIVE: ["QUARANTINED", "DEPLETED", "EXPIRED"],
  QUARANTINED: ["ACTIVE"],
  DEPLETED: ["ACTIVE"],
  EXPIRED: [],
};

export function canTransition<S extends string>(
  table: Record<S, readonly S[]>,
  from: S,
  to: S,
): boolean {
  return table[from].includes(to);
}
