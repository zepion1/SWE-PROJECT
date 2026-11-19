/**
 * M10 Public Catalog and Availability (F19, F20, F22)
 * Subparts: PublicProjection, AvailabilityClassifier
 * Tests: T12, T13, T43, T44, T50 · Iteration 5
 *
 * PRIVACY RULES (enforced here, before anything leaves the server):
 * - never return quantities: only PUBLIC_AVAILABILITY labels (T13)
 * - Schedule II -> "Contact pharmacy for availability" (T12, F22)
 * - availability counts only ACTIVE, sellable (unexpired) lots; all expired -> Out of Stock (T43)
 * - inactive products/listings are omitted
 * - cash price as a decimal string + INSURANCE_PRICING_NOTE (T44)
 */
import type { PublicAvailability, PublicProductResult, ScheduleClass } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Infra } from "../../context";
import type { ExpirationService } from "../m06-expiration/service";

export interface PublicSearchQuery {
  q: string;
  storeId?: string;
}

export class PublicCatalogService {
  constructor(
    private readonly infra: Infra,
    private readonly expiration: ExpirationService,
  ) {}

  /** DDS: searchProducts(query, storeFilter) -> PublicSearchResult. */
  searchProducts(query: PublicSearchQuery): PublicProductResult[] {
    throw notImplemented("M10 public search");
  }

  /** Stores where the product is publicly "In Stock" or "Low Stock" (used by M11). */
  storesWithStock(productId: string): { storeId: string; availability: PublicAvailability }[] {
    throw notImplemented("M10 stores with stock");
  }
}

/**
 * AvailabilityClassifier. Q3 (open) decides the exact Low Stock boundary;
 * implement together with T43's above/at/below-threshold cases.
 */
export function classifyAvailability(
  sellableQty: number,
  lowStockThreshold: number,
  scheduleClass: ScheduleClass,
): PublicAvailability {
  throw notImplemented("M10 availability classifier");
}
