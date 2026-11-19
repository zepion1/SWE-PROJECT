/**
 * M02 Product Catalog (F4, F19, F22)
 * Subparts: ProductValidator, ProductRepository
 * Tests: T25, T26 · Iteration 1
 *
 * Rules: NDC is a non-empty unique STRING (leading zeros preserved, T25);
 * duplicate NDC -> CONFLICT, missing dosage form -> VALIDATION_ERROR (T26);
 * schedule class is validated on save, never inferred from free text (DDS §5.2);
 * deactivation hides the product from normal listings (and from public search, M10).
 * Every write is audited in the same transaction (fail closed).
 */
import type { Page, ProductView, ScheduleClass } from "@pharma/shared";
import { errors } from "../../core/errors";
import { newId } from "../../core/ids";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import { isUniqueViolation } from "../../db/connection";
import type { AuditService } from "../m13-audit-reporting/service";
import { assertAuthorized } from "../m01-identity/rbac";

export interface ProductInput {
  ndc: string;
  brandName: string | null;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  scheduleClass: ScheduleClass;
}

export type ProductPatch = Partial<ProductInput> & { active?: boolean };

export interface ProductQuery {
  q?: string;
  includeInactive: boolean;
  limit: number;
  cursor?: string;
}

interface ProductRow {
  id: string;
  ndc: string;
  brand_name: string | null;
  generic_name: string;
  strength: string;
  dosage_form: string;
  category: string;
  schedule_class: ScheduleClass;
  active: 0 | 1;
}

/** Patchable fields -> column names (a whitelist: nothing else can be updated). */
const PATCH_COLUMNS: Record<keyof ProductPatch, keyof ProductRow> = {
  ndc: "ndc",
  brandName: "brand_name",
  genericName: "generic_name",
  strength: "strength",
  dosageForm: "dosage_form",
  category: "category",
  scheduleClass: "schedule_class",
  active: "active",
};

export class CatalogService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
  ) {}

  /** DDS: createProduct(dto) -> Product */
  createProduct(actor: Actor, input: ProductInput): ProductView {
    assertAuthorized(actor, "MANAGE_PRODUCTS", null);
    const { db, clock } = this.infra;
    const id = newId();
    const now = clock.now().toISOString();

    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO products
             (id, ndc, brand_name, generic_name, strength, dosage_form, category, schedule_class, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        ).run(
          id,
          input.ndc,
          input.brandName,
          input.genericName,
          input.strength,
          input.dosageForm,
          input.category,
          input.scheduleClass,
          now,
          now,
        );
        this.audit.record({
          actor,
          storeId: null,
          action: "PRODUCT_CREATED",
          entityType: "product",
          entityId: id,
          after: this.get(id),
        });
      })();
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict(`A product with NDC ${input.ndc} already exists`);
      throw err;
    }
    return this.get(id);
  }

  /** DDS: updateProduct(id, patch) -> Product. `active: false` deactivates, `active: true` reactivates. */
  updateProduct(actor: Actor, productId: string, patch: ProductPatch): ProductView {
    assertAuthorized(actor, "MANAGE_PRODUCTS", null);
    const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [keyof ProductPatch, unknown][];
    if (entries.length === 0) throw errors.validation("Nothing to update");

    const { db, clock } = this.infra;
    const before = this.get(productId);
    const sets = entries.map(([key]) => `${PATCH_COLUMNS[key]} = ?`);
    const values = entries.map(([key, v]) => (key === "active" ? (v ? 1 : 0) : v)) as (string | number | null)[];

    let action = "PRODUCT_UPDATED";
    if (patch.active === false && before.active) action = "PRODUCT_DEACTIVATED";
    if (patch.active === true && !before.active) action = "PRODUCT_REACTIVATED";

    try {
      db.transaction(() => {
        db.prepare(`UPDATE products SET ${sets.join(", ")}, updated_at = ? WHERE id = ?`).run(
          ...values,
          clock.now().toISOString(),
          productId,
        );
        this.audit.record({
          actor,
          storeId: null,
          action,
          entityType: "product",
          entityId: productId,
          before,
          after: this.get(productId),
        });
      })();
    } catch (err) {
      if (isUniqueViolation(err)) throw errors.conflict(`A product with NDC ${patch.ndc} already exists`);
      throw err;
    }
    return this.get(productId);
  }

  /** DDS: lookup(query) -> Products. Matches brand, generic or NDC (with or without hyphens). */
  lookup(query: ProductQuery): Page<ProductView> {
    const where: string[] = [];
    const params: string[] = [];
    if (!query.includeInactive) where.push("active = 1");

    const q = query.q?.trim();
    if (q) {
      const like = `%${escapeLike(q)}%`;
      const clauses = ["brand_name LIKE ? ESCAPE '\\'", "generic_name LIKE ? ESCAPE '\\'", "ndc LIKE ? ESCAPE '\\'"];
      params.push(like, like, like);
      const digits = q.replace(/-/g, "");
      if (/^\d{3,}$/.test(digits)) {
        clauses.push("replace(ndc, '-', '') LIKE ?");
        params.push(`%${digits}%`);
      }
      where.push(`(${clauses.join(" OR ")})`);
    }

    const offset = decodeCursor(query.cursor);
    const rows = this.infra.db
      .prepare(
        `SELECT * FROM products
         ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
         ORDER BY generic_name COLLATE NOCASE, strength, brand_name IS NOT NULL, brand_name, id
         LIMIT ? OFFSET ?`,
      )
      .all(...params, query.limit + 1, offset) as ProductRow[];

    const hasMore = rows.length > query.limit;
    return {
      items: rows.slice(0, query.limit).map(toView),
      nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
    };
  }

  /** Product by id, including inactive ones. */
  get(productId: string): ProductView {
    const row = this.infra.db.prepare("SELECT * FROM products WHERE id = ?").get(productId) as ProductRow | undefined;
    if (!row) throw errors.notFound("Product");
    return toView(row);
  }
}

function toView(row: ProductRow): ProductView {
  return {
    id: row.id,
    ndc: row.ndc,
    brandName: row.brand_name,
    genericName: row.generic_name,
    strength: row.strength,
    dosageForm: row.dosage_form,
    category: row.category,
    scheduleClass: row.schedule_class,
    active: row.active === 1,
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Opaque pagination cursor (DDS §4: cursor or bounded page). */
function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (!cursor) return 0;
  try {
    const { o } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o: unknown };
    if (typeof o === "number" && Number.isInteger(o) && o >= 0) return o;
  } catch {
    // fall through
  }
  throw errors.validation("Invalid cursor");
}
