import type { Adapters, GeocoderPort, MailPort, MfaPort, PosSignaturePort, SupplierPort } from "./ports";
import { TotpMfa } from "./totp";

/**
 * Deterministic stand-ins for external systems (Test Plan §4.7 "External stubs").
 * Used in development, tests and the demo. Each exposes its recorded calls so
 * tests can assert on side effects.
 */

export class StubSupplier implements SupplierPort {
  readonly sent: { orderId: string; idempotencyKey: string }[] = [];
  failNext = false;

  async sendOrder(input: Parameters<SupplierPort["sendOrder"]>[0]) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("Simulated supplier outage");
    }
    const existing = this.sent.find((s) => s.idempotencyKey === input.idempotencyKey);
    if (!existing) this.sent.push({ orderId: input.orderId, idempotencyKey: input.idempotencyKey });
    return { confirmationId: `CONF-${input.orderId}` };
  }
}

/** A few synthetic ZIP centroids near the seeded stores. */
const ZIP_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  "07043": { lat: 40.8649, lng: -74.1987 },
  "07011": { lat: 40.8784, lng: -74.1426 },
  "07102": { lat: 40.7357, lng: -74.1724 },
  "07042": { lat: 40.8126, lng: -74.2124 },
};

export class StubGeocoder implements GeocoderPort {
  available = true;

  async resolveZip(zip: string) {
    return ZIP_CENTROIDS[zip] ?? null;
  }

  directionsUrl(to: { lat: number; lng: number }) {
    return this.available ? `https://maps.example/directions?to=${to.lat},${to.lng}` : null;
  }
}

export class StubMail implements MailPort {
  readonly outbox: { to: string; subject: string; text: string }[] = [];
  async send(message: { to: string; subject: string; text: string }) {
    this.outbox.push(message);
  }
}

export const DEV_MFA_CODE = "123456";

/** Development/test MFA: accepts the fixed code 123456. Production uses TotpMfa (adapters/totp.ts). */
export class StubMfa implements MfaPort {
  verify(_secret: string | null, code: string) {
    return code === DEV_MFA_CODE;
  }
}

/** Accepts the fixed development signature "dev-signature". Replace with HMAC in Iteration 4 (M14). */
export class StubPosSignature implements PosSignaturePort {
  verify(_rawBody: string, signature: string | undefined) {
    return signature === "dev-signature";
  }
}

export function createStubAdapters(): Adapters {
  return {
    supplier: new StubSupplier(),
    geocoder: new StubGeocoder(),
    mail: new StubMail(),
    mfa: new StubMfa(),
    posSignature: new StubPosSignature(),
  };
}

/** Adapters for a running server: stubs for systems not yet integrated, real TOTP when MFA_MODE=totp. */
export function createAdapters(config: { mfaMode: "totp" | "dev" }): Adapters {
  return { ...createStubAdapters(), mfa: config.mfaMode === "totp" ? new TotpMfa() : new StubMfa() };
}
