/**
 * Ports to external systems (DDS §3.1: "External systems are behind adapters").
 * Modules depend on these interfaces only, never on a concrete vendor SDK.
 * Adapters may NOT write stock directly; they call application services.
 */

export interface SupplierPort {
  /** Transmit an APPROVED purchase order. Must be idempotent per `idempotencyKey` (T65). */
  sendOrder(input: {
    orderId: string;
    supplierId: string;
    lines: { productId: string; qty: number }[];
    idempotencyKey: string;
  }): Promise<{ confirmationId: string }>;
}

export interface GeocoderPort {
  /** Resolve a US ZIP code to coordinates. Returns null when unknown. Never persist the input. */
  resolveZip(zip: string): Promise<{ lat: number; lng: number } | null>;
  /** Build a directions link to a store, or null if the map provider is unavailable. */
  directionsUrl(to: { lat: number; lng: number }): string | null;
}

export interface MailPort {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export interface MfaPort {
  /** Verify a one-time code for a user's MFA secret at the given time. */
  verify(secret: string | null, code: string, at: Date): boolean;
}

/** POS events are HMAC-signed by the store's POS system (M14, T17). */
export interface PosSignaturePort {
  verify(rawBody: string, signature: string | undefined): boolean;
}

export interface Adapters {
  supplier: SupplierPort;
  geocoder: GeocoderPort;
  mail: MailPort;
  mfa: MfaPort;
  posSignature: PosSignaturePort;
}
