import {
  ADJUSTMENT_TRANSITIONS,
  canTransition,
  PURCHASE_ORDER_TRANSITIONS,
  RECOMMENDATION_TRANSITIONS,
} from "@pharma/shared";
import { describe, expect, it } from "vitest";
import { addDays, daysBetween, localDate } from "../src/core/clock";
import { formatCents, parseCents } from "../src/core/money";
import { classifyExpiry, isSellable } from "../src/modules/m06-expiration/service";

describe("state machines (DDS §7.1)", () => {
  it("purchase orders cannot skip approval or revive a canceled order (policy for T38, T09)", () => {
    expect(canTransition(PURCHASE_ORDER_TRANSITIONS, "DRAFT", "SENT")).toBe(false);
    expect(canTransition(PURCHASE_ORDER_TRANSITIONS, "CANCELED", "RECEIVED")).toBe(false);
    const path = ["DRAFT", "APPROVED", "SENT", "RECEIVED"] as const;
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(PURCHASE_ORDER_TRANSITIONS, path[i - 1]!, path[i]!)).toBe(true);
    }
  });

  it("a reviewed adjustment cannot be reviewed again (policy for T29)", () => {
    expect(canTransition(ADJUSTMENT_TRANSITIONS, "REJECTED", "APPROVED")).toBe(false);
    expect(canTransition(ADJUSTMENT_TRANSITIONS, "APPROVED", "APPROVED")).toBe(false);
    expect(canTransition(ADJUSTMENT_TRANSITIONS, "PENDING", "APPROVED")).toBe(true);
  });

  it("recommendations only move from PROPOSED", () => {
    expect(canTransition(RECOMMENDATION_TRANSITIONS, "PROPOSED", "EDITED")).toBe(true);
    expect(canTransition(RECOMMENDATION_TRANSITIONS, "REJECTED", "ACCEPTED")).toBe(false);
  });
});

describe("expiry rules (M06, Q2 default: unsellable on the expiry date)", () => {
  const today = "2026-11-19";

  it.each([
    [-1, false, "EXPIRED"],
    [0, false, "EXPIRED"],
    [1, true, "WITHIN_30"],
    [30, true, "WITHIN_30"],
    [31, true, "WITHIN_60"],
    [60, true, "WITHIN_60"],
    [61, true, "WITHIN_90"],
    [90, true, "WITHIN_90"],
    [91, true, null],
  ] as const)("T32 boundary: %i days left -> sellable=%s, bucket=%s", (days, sellable, bucket) => {
    const expiresOn = addDays(today, days);
    expect(isSellable(expiresOn, today)).toBe(sellable);
    expect(classifyExpiry(expiresOn, today)).toBe(bucket);
  });
});

describe("time and money helpers", () => {
  it("computes the store-local date across the UTC midnight boundary", () => {
    const instant = new Date("2026-11-20T03:30:00Z"); // 22:30 on Nov 19 in New York
    expect(localDate(instant, "America/New_York")).toBe("2026-11-19");
    expect(localDate(instant, "UTC")).toBe("2026-11-20");
  });

  it("counts calendar days and crosses month ends", () => {
    expect(daysBetween("2026-11-19", "2026-12-19")).toBe(30);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("parses and formats cents without floating point (supports T44)", () => {
    expect(parseCents("12.99")).toBe(1299);
    expect(parseCents("5")).toBe(500);
    expect(parseCents("0.5")).toBe(50);
    expect(formatCents(1299)).toBe("12.99");
    expect(formatCents(5)).toBe("0.05");
    expect(() => parseCents("12.999")).toThrow(RangeError);
    expect(() => parseCents("-1")).toThrow(RangeError);
  });
});
