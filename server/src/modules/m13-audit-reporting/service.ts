/**
 * M13 Reporting and Audit (F3, F25)
 * Subparts: AuditWriter, ReportQueries, ExportSerializer
 * Tests: T16, T24, T49 · Iteration 1 (audit writer), Iteration 3 (reports)
 *
 * INVARIANT: `record` must be called INSIDE the caller's db.transaction(...)
 * so the audit row and the stock change commit or roll back together (DDS §4.1).
 * If the audit insert fails, the whole stock change must fail (fail closed, T16).
 */
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";

export interface AuditEntry {
  actor: Actor;
  storeId: string | null;
  action: string; // e.g. "RECEIPT", "SALE", "ADJUSTMENT_APPROVED", "PRODUCT_UPDATED"
  entityType: string; // e.g. "lot", "product", "purchase_order"
  entityId: string;
  before?: unknown;
  after?: unknown;
  requestId?: string;
}

export const REPORT_TYPES = ["INVENTORY_VALUE", "STOCK_MOVEMENT", "EXPIRATION_LOSS", "FORECAST_ACCURACY"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface AuditQuery {
  storeId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  limit: number;
}

export class AuditService {
  constructor(private readonly infra: Infra) {}

  /** DDS: recordAudit(event) -> void. Append-only (DB triggers reject UPDATE/DELETE). */
  record(entry: AuditEntry): void {
    throw notImplemented("M13 audit writer");
  }

  /** Proposed for Q7: System Administrator reviews audit logs. */
  list(actor: Actor, query: AuditQuery): unknown[] {
    throw notImplemented("M13 audit log query");
  }

  /** DDS: exportReport(type, period) -> File. Returns CSV text; cells escaped by escapeCsvCell (T49). */
  exportReport(actor: Actor, storeId: string, input: { type: ReportType; from: string; to: string }): string {
    throw notImplemented("M13 report export");
  }
}

/**
 * Neutralise CSV/spreadsheet formula injection: prefix cells starting with
 * = + - @ (or tab / carriage return) with a single quote, and quote as needed (T49).
 */
export function escapeCsvCell(value: unknown): string {
  throw notImplemented("M13 CSV escaping");
}
