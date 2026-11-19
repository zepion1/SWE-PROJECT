/**
 * Money is stored as integer cents (DDS §4: never binary floating point).
 */

/** Parse a decimal string such as "12.99" or "5" into cents. Throws on bad input. */
export function parseCents(value: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new RangeError(`Invalid money amount: "${value}"`);
  const dollars = Number(match[1]);
  const cents = Number((match[2] ?? "").padEnd(2, "0"));
  return dollars * 100 + cents;
}

/** Format cents as a decimal string, e.g. 1299 -> "12.99". */
export function formatCents(cents: number): string {
  if (!Number.isInteger(cents)) throw new RangeError(`Cents must be an integer: ${cents}`);
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
