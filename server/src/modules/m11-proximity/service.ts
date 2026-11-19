/**
 * M11 Pharmacy Proximity (F21)
 * Subparts: LocationResolver, DistanceSorter, MapAdapter
 * Tests: T14, T45, T46, T57 · Iteration 5
 *
 * PRIVACY: the customer's coordinates or ZIP are used in memory for this request
 * only. Never store them, log them, or pass them to analytics (N5, T57).
 * Sort by distance ascending with a stable tie-break (store id) (T45).
 * Map provider down -> still return the list, with directionsUrl = null (T45).
 * Schedule II -> no store-level availability revealed (T46).
 */
import type { NearbyPharmacy } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Infra } from "../../context";
import type { PublicCatalogService } from "../m10-public-catalog/service";

export type Origin = { zip: string } | { lat: number; lng: number };

export class ProximityService {
  constructor(
    private readonly infra: Infra,
    private readonly publicCatalog: PublicCatalogService,
  ) {}

  /** DDS: nearby(productId, locationOrZip) -> PharmacyList. */
  async nearby(productId: string, origin: Origin): Promise<NearbyPharmacy[]> {
    throw notImplemented("M11 nearest pharmacy");
  }
}

/** Great-circle distance in miles. */
export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  throw notImplemented("M11 distance calculation");
}
