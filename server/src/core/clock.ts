/**
 * Injectable clock. Expiry boundaries, daily alerts and OTP expiry must be
 * testable at exact dates (Test Plan §4.2, §4.7 "clock control").
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/** A clock frozen at `iso`; call `set` to move it in tests. */
export function fixedClock(iso: string): Clock & { set(iso: string): void } {
  let current = new Date(iso);
  return {
    now: () => new Date(current.getTime()),
    set: (next: string) => {
      current = new Date(next);
    },
  };
}

/** Calendar date (YYYY-MM-DD) at `instant` in an IANA timezone such as "America/New_York". */
export function localDate(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Whole days from calendar date `from` to calendar date `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Add `days` to a calendar date (YYYY-MM-DD). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
