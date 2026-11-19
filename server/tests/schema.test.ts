import { describe, expect, it } from "vitest";
import { runMigrations } from "../src/db/migrate";
import { createTestApp } from "./helpers";

/** The database itself enforces the DDS §5.2 constraints and §4.1 invariants. */
describe("schema constraints", () => {
  const { db } = createTestApp({ seed: true });

  it("migrations are idempotent", () => {
    expect(runMigrations(db)).toEqual([]);
  });

  it("keeps NDC leading zeros (supports T25)", () => {
    const row = db.prepare("SELECT ndc FROM products WHERE id = 'prod-amox'").get() as { ndc: string };
    expect(row.ndc).toBe("09999-0201-50");
  });

  it("rejects a duplicate NDC (supports T26)", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO products (id, ndc, generic_name, strength, dosage_form, category)
           VALUES ('dup', '09999-0201-50', 'X', '1 mg', 'Tablet', 'Other')`,
        )
        .run(),
    ).toThrow(/UNIQUE/);
  });

  it("never allows negative lot quantity", () => {
    expect(() => db.prepare("UPDATE lots SET qty_on_hand = -1 WHERE id = 'lot-amox-1'").run()).toThrow(/CHECK/);
  });

  it("stock_movements and audit_events are append-only", () => {
    db.prepare(
      "INSERT INTO stock_movements (id, lot_id, delta, type) VALUES ('mv-1', 'lot-amox-1', 5, 'RECEIPT')",
    ).run();
    expect(() => db.prepare("UPDATE stock_movements SET delta = 6 WHERE id = 'mv-1'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM stock_movements WHERE id = 'mv-1'").run()).toThrow(/append-only/);

    db.prepare(
      `INSERT INTO audit_events (id, actor_type, actor_id, action, entity_type, entity_id)
       VALUES ('ae-1', 'USER', 'user-manager', 'TEST', 'lot', 'lot-amox-1')`,
    ).run();
    expect(() => db.prepare("DELETE FROM audit_events WHERE id = 'ae-1'").run()).toThrow(/append-only/);
  });

  it("only allows forecast horizons 7, 30 and 90 (supports T40)", () => {
    const insert = db.prepare(
      `INSERT INTO forecasts (id, store_product_id, horizon_days, predicted_units, model_version)
       VALUES (?, 'sp-montclair-amox', ?, 10, 'baseline-0')`,
    );
    expect(() => insert.run("f-30", 30)).not.toThrow();
    expect(() => insert.run("f-45", 45)).toThrow(/CHECK/);
  });

  it("allows one alert per store/type/resource/day (supports T15)", () => {
    const insert = db.prepare(
      `INSERT INTO alerts (id, store_id, alert_type, resource_id, message, alert_date)
       VALUES (?, 'store-montclair', 'EXPIRED', 'lot-atorva-m1', 'Expired lot', '2026-11-19')`,
    );
    insert.run("al-1");
    expect(() => insert.run("al-2")).toThrow(/UNIQUE/);
  });

  it("allows each POS external event id only once (supports T05)", () => {
    const insert = db.prepare(
      `INSERT INTO sales_events (id, external_event_id, store_id, product_id, qty, sold_at, result_json)
       VALUES (?, 'pos-1', 'store-montclair', 'prod-amox', 1, '2026-11-19T15:00:00Z', '{}')`,
    );
    insert.run("se-1");
    expect(() => insert.run("se-2")).toThrow(/UNIQUE/);
  });
});
