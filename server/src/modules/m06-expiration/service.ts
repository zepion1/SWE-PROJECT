/**
 * M06 Expiration Management (F9, F10, F11)
 * Subparts: ExpiryClassifier, AlertScheduler, FEFOAdvisor
 * Tests: T08, T32, T34, T35 (related T03, T15) · Iteration 2
 *
 * The date rules below ARE implemented in the skeleton because every module
 * that touches stock must agree on them. Change Q2 in one place only.
 */
import type { ExpiryBucket, ExpiryWindow, LotView } from "@pharma/shared";
import { daysBetween, localDate } from "../../core/clock";
import { errors, notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";

/**
 * Q2 (open): is a lot sellable ON its expires_on date?
 * Skeleton default: NO. A lot expiring today is already unsellable (fail safe).
 */
export const EXPIRES_ON_IS_SELLABLE = false;

/** DDS: isSellable(lot, date) -> bool. `today` is the store-local date (YYYY-MM-DD). */
export function isSellable(expiresOn: string, today: string): boolean {
  const daysLeft = daysBetween(today, expiresOn);
  return EXPIRES_ON_IS_SELLABLE ? daysLeft >= 0 : daysLeft > 0;
}

/**
 * Bucket a lot for the expiration dashboard (DDS Appendix B.2, T32).
 * Returns null when the lot expires more than 90 days out.
 */
export function classifyExpiry(expiresOn: string, today: string): ExpiryBucket | null {
  if (!isSellable(expiresOn, today)) return "EXPIRED";
  const daysLeft = daysBetween(today, expiresOn);
  if (daysLeft <= 30) return "WITHIN_30";
  if (daysLeft <= 60) return "WITHIN_60";
  if (daysLeft <= 90) return "WITHIN_90";
  return null;
}

export class ExpirationService {
  constructor(private readonly infra: Infra) {}

  /** Today's calendar date in the store's own timezone (DDS §4 "Time"). */
  todayForStore(storeId: string): string {
    const row = this.infra.db.prepare("SELECT timezone FROM stores WHERE id = ?").get(storeId) as
      | { timezone: string }
      | undefined;
    if (!row) throw errors.notFound("Store");
    return localDate(this.infra.clock.now(), row.timezone);
  }

  /** DDS: listExpiring(storeId, days) -> Lots (expired + within `days`). */
  listExpiring(storeId: string, days: ExpiryWindow): LotView[] {
    throw notImplemented("M06 list expiring lots");
  }

  /** DDS: recommendFEFO(product, store) -> Lots, earliest-expiring sellable lot first (T34). */
  recommendFefo(storeId: string, productId: string): LotView[] {
    throw notImplemented("M06 first-expired-first-out advice");
  }

  /** F11: record disposal/return through M04 and compute the dollar loss in cents (T35, Q11). */
  recordDisposal(
    actor: Actor,
    input: { storeId: string; lotId: string; qty: number; type: "DISPOSAL" | "RETURN"; reason: string },
  ): { movementId: string; lossCents: number } {
    throw notImplemented("M06 record disposal");
  }
}
