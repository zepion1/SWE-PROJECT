/**
 * Time-based one-time passwords (RFC 6238 / RFC 4226), compatible with
 * Google Authenticator, Microsoft Authenticator, 1Password, etc.
 * Implemented with node:crypto only: HMAC-SHA1, 30-second steps, 6 digits.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { MfaPort } from "./ports";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Accept the previous and next 30-second step to tolerate clock drift. */
const DRIFT_STEPS = 1;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) throw new RangeError(`Invalid base32 character "${char}"`);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** New 160-bit secret, base32-encoded (RFC 4226 §4 recommends 160 bits). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP value for a counter (RFC 4226 §5.3 dynamic truncation). */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(message).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return String(binary).padStart(digits, "0");
}

/** TOTP code for a base32 secret at a point in time. */
export function totp(secretBase32: string, at: Date, digits = DIGITS): string {
  return hotp(base32Decode(secretBase32), Math.floor(at.getTime() / 1000 / STEP_SECONDS), digits);
}

export function verifyTotp(secretBase32: string, code: string, at: Date): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  const key = base32Decode(secretBase32);
  const counter = Math.floor(at.getTime() / 1000 / STEP_SECONDS);
  const given = Buffer.from(code);
  for (let drift = -DRIFT_STEPS; drift <= DRIFT_STEPS; drift++) {
    if (timingSafeEqual(Buffer.from(hotp(key, counter + drift)), given)) return true;
  }
  return false;
}

/** Provisioning URI that authenticator apps import (usually shown as a QR code). */
export function otpauthUri(secretBase32: string, accountEmail: string, issuer = "RedHawk Pharmacy"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** Production MFA adapter: real TOTP verification against the user's stored secret. */
export class TotpMfa implements MfaPort {
  verify(secret: string | null, code: string, at: Date): boolean {
    return secret !== null && verifyTotp(secret, code, at);
  }
}
