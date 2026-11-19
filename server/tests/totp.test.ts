import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, otpauthUri, totp, TotpMfa, verifyTotp } from "../src/adapters/totp";

// RFC 6238 Appendix B test secret (SHA-1): ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890", "ascii"));

describe("TOTP (RFC 6238) for staff MFA (F1)", () => {
  it.each([
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
  ])("matches the RFC 6238 SHA-1 vector at T=%i", (seconds, expected) => {
    expect(totp(RFC_SECRET, new Date(seconds * 1000), 8)).toBe(expected);
  });

  it("matches the RFC 4226 HOTP vectors", () => {
    const key = Buffer.from("12345678901234567890", "ascii");
    expect([0, 1, 2, 9].map((c) => hotp(key, c))).toEqual(["755224", "287082", "359152", "520489"]);
  });

  it("round-trips base32", () => {
    const bytes = Buffer.from([0, 1, 2, 250, 255, 128, 64]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
    expect(() => base32Decode("not base32!")).toThrow(RangeError);
  });

  it("accepts one 30-second step of clock drift, but not two", () => {
    const now = new Date("2026-11-19T15:00:00Z");
    const code = totp(RFC_SECRET, now);
    expect(verifyTotp(RFC_SECRET, code, new Date(now.getTime() + 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(now.getTime() - 30_000))).toBe(true);
    expect(verifyTotp(RFC_SECRET, code, new Date(now.getTime() + 90_000))).toBe(false);
  });

  it("rejects malformed codes and users without a secret", () => {
    const now = new Date();
    expect(verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
    expect(new TotpMfa().verify(null, totp(RFC_SECRET, now), now)).toBe(false);
  });

  it("builds an authenticator provisioning URI", () => {
    const uri = otpauthUri("ABCDEF", "tech@redhawk.test");
    expect(uri).toMatch(/^otpauth:\/\/totp\/RedHawk%20Pharmacy%3Atech%40redhawk\.test\?/);
    expect(uri).toContain("secret=ABCDEF");
    expect(uri).toContain("issuer=RedHawk+Pharmacy");
  });
});
