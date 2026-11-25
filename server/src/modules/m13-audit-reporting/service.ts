/**
 * M13 Reporting and Audit (F3, F25)
 * Subparts: AuditWriter, ReportQueries, ExportSerializer
 * Tests: T16, T24, T49 · Iteration 1 (audit writer + audit log), Iteration 3 (reports)
 *
 * INVARIANT: `record` must be called INSIDE the caller's db.transaction(...)
 * so the audit row and the change it describes commit or roll back together
 * (DDS §4.1). If the audit insert throws, the caller's transaction aborts and
 * the change is not committed (fail closed, T16).
 */
import type { AuditEventView } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import { newId } from "../../core/ids";
import { actorId, type Actor } from "../../core/types";
import type { Infra } from "../../context";
import { assertAuthorized } from "../m01-identity/rbac";

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
  /** Inclusive start date (YYYY-MM-DD, UTC). */
  from?: string;
  /** Inclusive end date (YYYY-MM-DD, UTC). */
  to?: string;
  limit: number;
}

interface AuditRow {
  id: string;
  actor_type: "USER" | "SERVICE";
  actor_id: string;
  store_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  before_json: string | null;
  after_json: string | null;
  at: string;
}

/** Keys that must never be written to the audit trail, whatever the caller passes. */
const SENSITIVE_KEY = /password|secret|token|otp/i;

/** Defensive redaction: drop sensitive keys at any depth before serializing. */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SENSITIVE_KEY.test(key))
        .map(([key, v]) => [key, redact(v)]),
    );
  }
  return value;
}

export class AuditService {
  constructor(private readonly infra: Infra) {}

  /** DDS: recordAudit(event) -> void. Append-only (DB triggers reject UPDATE/DELETE). */
  record(entry: AuditEntry): void {
    this.infra.db
      .prepare(
        `INSERT INTO audit_events
           (id, actor_type, actor_id, store_id, action, entity_type, entity_id, before_json, after_json, request_id, at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        newId(),
        entry.actor.kind,
        actorId(entry.actor),
        entry.storeId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.before === undefined ? null : JSON.stringify(redact(entry.before)),
        entry.after === undefined ? null : JSON.stringify(redact(entry.after)),
        entry.requestId ?? null,
        this.infra.clock.now().toISOString(),
      );
  }

  /** Q7 (proposed): the System Administrator reviews audit logs. Newest first. */
  list(actor: Actor, query: AuditQuery): AuditEventView[] {
    assertAuthorized(actor, "VIEW_AUDIT", null);

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (query.storeId) {
      where.push("store_id = ?");
      params.push(query.storeId);
    }
    if (query.entityType) {
      where.push("entity_type = ?");
      params.push(query.entityType);
    }
    if (query.entityId) {
      where.push("entity_id = ?");
      params.push(query.entityId);
    }
    if (query.from) {
      where.push("at >= ?");
      params.push(`${query.from}T00:00:00.000Z`);
    }
    if (query.to) {
      where.push("at <= ?");
      params.push(`${query.to}T23:59:59.999Z`);
    }

    const rows = this.infra.db
      .prepare(
        `SELECT id, actor_type, actor_id, store_id, action, entity_type, entity_id, before_json, after_json, at
         FROM audit_events
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(...params, query.limit) as AuditRow[];

    return rows.map((r) => ({
      id: r.id,
      actorType: r.actor_type,
      actorId: r.actor_id,
      storeId: r.store_id,
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      before: r.before_json === null ? null : JSON.parse(r.before_json),
      after: r.after_json === null ? null : JSON.parse(r.after_json),
      at: r.at,
    }));
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
