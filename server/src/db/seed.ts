import { addDays, localDate, systemClock, type Clock } from "../core/clock";
import { hashPassword } from "../core/crypto";
import type { Db } from "./connection";

/**
 * Synthetic demo data shaped by the Test Plan §4.6 baseline:
 * - 3 stores in different ZIP codes
 * - products with leading-zero NDCs, a Schedule II product, brand/generic pairs
 * - lots expiring at -1, 0, 30, 31, 60, 61, 90, 91 days from today
 * - one staff user per role, plus a technician assigned to a different store
 *
 * ALL DATA IS FICTIONAL. NDCs use labeler code 09999, which is not a real labeler.
 * Dev password for every seeded user: "ChangeMe!123" (local development only).
 */
export const SEED_PASSWORD = "ChangeMe!123";

/**
 * Seeded staff with FIXED, PUBLIC TOTP secrets (base32), for local demos only.
 * With MFA_MODE=totp, add a secret to an authenticator app or run
 * `npm run mfa:code -- <email>` to print the current code.
 */
export const SEED_USERS = [
  { id: "user-admin", email: "admin@redhawk.test", displayName: "Avery Admin", mfaSecret: "REDHAWKADMIN2345REDHAWKADMIN2345" },
  { id: "user-manager", email: "manager@redhawk.test", displayName: "Morgan Manager", mfaSecret: "REDHAWKMANAGER23REDHAWKMANAGER23" },
  { id: "user-tech", email: "tech@redhawk.test", displayName: "Taylor Technician", mfaSecret: "REDHAWKTECH23456REDHAWKTECH23456" },
  { id: "user-tech-clifton", email: "tech.clifton@redhawk.test", displayName: "Casey Technician", mfaSecret: "REDHAWKCLIFTON23REDHAWKCLIFTON23" },
] as const;

export function seedDemoData(db: Db, clock: Clock = systemClock): void {
  const tz = "America/New_York";
  const today = localDate(clock.now(), tz);

  const insert = db.transaction(() => {
    const store = db.prepare(
      `INSERT OR IGNORE INTO stores (id, name, address, postal_code, latitude, longitude, timezone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    store.run("store-montclair", "RedHawk Pharmacy Montclair", "1 Normal Ave, Montclair, NJ", "07043", 40.8649, -74.1987, tz);
    store.run("store-clifton", "RedHawk Pharmacy Clifton", "100 Main Ave, Clifton, NJ", "07011", 40.8784, -74.1426, tz);
    store.run("store-newark", "RedHawk Pharmacy Newark", "200 Broad St, Newark, NJ", "07102", 40.7357, -74.1724, tz);

    const user = db.prepare(
      `INSERT OR IGNORE INTO users (id, email, display_name, password_hash, mfa_secret, mfa_enabled)
       VALUES (?, ?, ?, ?, ?, 1)`,
    );
    const role = db.prepare(
      `INSERT OR IGNORE INTO role_assignments (id, user_id, store_id, role) VALUES (?, ?, ?, ?)`,
    );
    const pw = hashPassword(SEED_PASSWORD);
    for (const u of SEED_USERS) user.run(u.id, u.email, u.displayName, pw, u.mfaSecret);
    role.run("ra-admin", "user-admin", null, "SYSTEM_ADMIN");
    role.run("ra-manager", "user-manager", "store-montclair", "PHARMACIST_MANAGER");
    role.run("ra-tech", "user-tech", "store-montclair", "TECHNICIAN");
    role.run("ra-tech-clifton", "user-tech-clifton", "store-clifton", "TECHNICIAN");

    const product = db.prepare(
      `INSERT OR IGNORE INTO products (id, ndc, brand_name, generic_name, strength, dosage_form, category, schedule_class)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    product.run("prod-atorva-brand", "09999-0101-30", "Lipitor", "Atorvastatin", "20 mg", "Tablet", "Cardiovascular", "NONE");
    product.run("prod-atorva-gen", "09999-0102-30", null, "Atorvastatin", "20 mg", "Tablet", "Cardiovascular", "NONE");
    product.run("prod-amox", "09999-0201-50", null, "Amoxicillin", "500 mg", "Capsule", "Antibiotic", "NONE");
    product.run("prod-lisin", "09999-0301-90", null, "Lisinopril", "10 mg", "Tablet", "Cardiovascular", "NONE");
    product.run("prod-ibu", "09999-0401-24", "Advil", "Ibuprofen", "200 mg", "Tablet", "Analgesic", "NONE");
    product.run("prod-oxy", "09999-0501-10", null, "Oxycodone", "5 mg", "Tablet", "Analgesic", "II");
    product.run("prod-metf", "09999-0601-60", null, "Metformin", "500 mg", "Tablet", "Endocrine", "NONE");

    const supplier = db.prepare(
      `INSERT OR IGNORE INTO suppliers (id, name, contact_email, contact_phone, lead_days, minimum_order_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    supplier.run("sup-acme", "Acme Pharma Distribution", "orders@acme.example", "555-0100", 2, 10000);
    supplier.run("sup-north", "Northeast Medical Supply", "po@northeast.example", "555-0200", 5, 25000);

    const listing = db.prepare(
      `INSERT OR IGNORE INTO store_products (id, store_id, product_id, cash_price_cents, reorder_point, low_stock_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`,
    );
    const prices: Record<string, number> = {
      "prod-atorva-brand": 8999,
      "prod-atorva-gen": 1299,
      "prod-amox": 1099,
      "prod-lisin": 799,
      "prod-ibu": 649,
      "prod-oxy": 2499,
      "prod-metf": 599,
    };
    for (const storeId of ["store-montclair", "store-clifton", "store-newark"]) {
      for (const [productId, cents] of Object.entries(prices)) {
        listing.run(`sp-${storeId.slice(6)}-${productId.slice(5)}`, storeId, productId, cents, 20, 10);
      }
    }

    // Lots at the Test Plan §4.6 expiry boundaries for Montclair atorvastatin (generic).
    const lot = db.prepare(
      `INSERT OR IGNORE INTO lots (id, store_product_id, supplier_id, lot_number, expires_on, qty_on_hand, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const days of [-1, 0, 30, 31, 60, 61, 90, 91]) {
      const label = days < 0 ? `m${-days}` : String(days);
      lot.run(
        `lot-atorva-${label}`,
        "sp-montclair-atorva-gen",
        "sup-acme",
        `ATV-${label}`,
        addDays(today, days),
        10,
        days < 0 ? "EXPIRED" : "ACTIVE",
      );
    }
    lot.run("lot-amox-1", "sp-montclair-amox", "sup-north", "AMX-001", addDays(today, 200), 40, "ACTIVE");
    lot.run("lot-oxy-1", "sp-montclair-oxy", "sup-north", "OXY-001", addDays(today, 365), 25, "ACTIVE");
    lot.run("lot-lisin-low", "sp-montclair-lisin", "sup-acme", "LSN-001", addDays(today, 300), 5, "ACTIVE");
  });

  insert();
}
