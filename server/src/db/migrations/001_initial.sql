-- 001_initial.sql: full data model from DDS §5 (Data Model and Invariants).
-- Conventions (DDS §4): TEXT UUID ids; NDC as TEXT; money as INTEGER cents;
-- timestamps as ISO-8601 UTC TEXT; expires_on as store-local 'YYYY-MM-DD'.

-- ---------------------------------------------------------------------------
-- Stores, staff identity and roles (M01)
-- ---------------------------------------------------------------------------
CREATE TABLE stores (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  address      TEXT NOT NULL,
  postal_code  TEXT NOT NULL,
  latitude     REAL,
  longitude    REAL,
  timezone     TEXT NOT NULL DEFAULT 'America/New_York',
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name        TEXT NOT NULL,
  password_hash       TEXT NOT NULL,
  mfa_secret          TEXT,
  mfa_enabled         INTEGER NOT NULL DEFAULT 1 CHECK (mfa_enabled IN (0, 1)),
  status              TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'LOCKED', 'DISABLED')),
  failed_login_count  INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE role_assignments (
  id        TEXT PRIMARY KEY,
  user_id   TEXT NOT NULL REFERENCES users(id),
  store_id  TEXT REFERENCES stores(id),          -- NULL = all stores
  role      TEXT NOT NULL CHECK (role IN ('PHARMACIST_MANAGER', 'TECHNICIAN', 'SYSTEM_ADMIN')),
  UNIQUE (user_id, store_id, role)
);

CREATE TABLE sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id),
  token_hash  TEXT NOT NULL UNIQUE,               -- never store the raw token
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT NOT NULL,
  revoked_at  TEXT
);

-- ---------------------------------------------------------------------------
-- Catalog (M02) and per-store listings
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id              TEXT PRIMARY KEY,
  ndc             TEXT NOT NULL UNIQUE CHECK (length(ndc) > 0),  -- string: keep leading zeros
  brand_name      TEXT,
  generic_name    TEXT NOT NULL,
  strength        TEXT NOT NULL,
  dosage_form     TEXT NOT NULL CHECK (length(dosage_form) > 0),
  category        TEXT NOT NULL,
  schedule_class  TEXT NOT NULL DEFAULT 'NONE' CHECK (schedule_class IN ('NONE', 'I', 'II', 'III', 'IV', 'V')),
  active          INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_products_generic ON products (generic_name);
CREATE INDEX idx_products_brand ON products (brand_name);

CREATE TABLE store_products (
  id                   TEXT PRIMARY KEY,
  store_id             TEXT NOT NULL REFERENCES stores(id),
  product_id           TEXT NOT NULL REFERENCES products(id),
  cash_price_cents     INTEGER NOT NULL CHECK (cash_price_cents >= 0),
  reorder_point        INTEGER NOT NULL DEFAULT 0 CHECK (reorder_point >= 0),
  low_stock_threshold  INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),  -- Q3: may merge with reorder_point
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  UNIQUE (store_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Suppliers (M07)
-- ---------------------------------------------------------------------------
CREATE TABLE suppliers (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  contact_name         TEXT,
  contact_email        TEXT,
  contact_phone        TEXT,
  lead_days            INTEGER NOT NULL CHECK (lead_days >= 0),
  minimum_order_cents  INTEGER NOT NULL DEFAULT 0 CHECK (minimum_order_cents >= 0),
  active               INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
);

CREATE TABLE supplier_products (                  -- F12 "prices"; unit cost for Q11
  id               TEXT PRIMARY KEY,
  supplier_id      TEXT NOT NULL REFERENCES suppliers(id),
  product_id       TEXT NOT NULL REFERENCES products(id),
  unit_cost_cents  INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  UNIQUE (supplier_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Lots and the append-only stock ledger (M03, M04)
-- ---------------------------------------------------------------------------
CREATE TABLE lots (
  id                TEXT PRIMARY KEY,
  store_product_id  TEXT NOT NULL REFERENCES store_products(id),
  supplier_id       TEXT NOT NULL REFERENCES suppliers(id),
  lot_number        TEXT NOT NULL,
  expires_on        TEXT NOT NULL CHECK (expires_on GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
  qty_on_hand       INTEGER NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),   -- invariant: never negative
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'QUARANTINED', 'DEPLETED', 'EXPIRED')),
  version           INTEGER NOT NULL DEFAULT 1,                            -- optimistic concurrency
  received_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (store_product_id, lot_number, supplier_id)
);
CREATE INDEX idx_lots_sellable ON lots (store_product_id, status, expires_on);

CREATE TABLE stock_movements (
  id                 TEXT PRIMARY KEY,
  lot_id             TEXT NOT NULL REFERENCES lots(id),
  delta              INTEGER NOT NULL CHECK (delta <> 0),
  type               TEXT NOT NULL CHECK (type IN ('RECEIPT', 'SALE', 'ADJUSTMENT', 'DISPOSAL', 'RETURN')),
  reason             TEXT,
  external_event_id  TEXT,
  actor_id           TEXT,
  occurred_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_movements_lot ON stock_movements (lot_id, occurred_at);
CREATE INDEX idx_movements_event ON stock_movements (external_event_id);

CREATE TRIGGER stock_movements_append_only_update BEFORE UPDATE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'stock_movements is append-only'); END;
CREATE TRIGGER stock_movements_append_only_delete BEFORE DELETE ON stock_movements
BEGIN SELECT RAISE(ABORT, 'stock_movements is append-only'); END;

-- ---------------------------------------------------------------------------
-- Adjustments and cycle counts (M05)
-- ---------------------------------------------------------------------------
CREATE TABLE adjustment_requests (
  id                TEXT PRIMARY KEY,
  lot_id            TEXT NOT NULL REFERENCES lots(id),
  source            TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'CYCLE_COUNT')),
  requested_delta   INTEGER NOT NULL CHECK (requested_delta <> 0),
  counted_qty       INTEGER CHECK (counted_qty IS NULL OR counted_qty >= 0),
  reason_code       TEXT NOT NULL,
  note              TEXT,
  status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  expected_version  INTEGER NOT NULL,
  requested_by      TEXT NOT NULL REFERENCES users(id),
  requested_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  reviewed_by       TEXT REFERENCES users(id),
  reviewed_at       TEXT
);
CREATE INDEX idx_adjustments_status ON adjustment_requests (status);

-- ---------------------------------------------------------------------------
-- Forecasts and recommendations (M08, M09): advisory only
-- ---------------------------------------------------------------------------
CREATE TABLE forecasts (
  id                 TEXT PRIMARY KEY,
  store_product_id   TEXT NOT NULL REFERENCES store_products(id),
  horizon_days       INTEGER NOT NULL CHECK (horizon_days IN (7, 30, 90)),
  predicted_units    REAL NOT NULL CHECK (predicted_units >= 0),
  model_version      TEXT NOT NULL,
  quality            TEXT,                         -- e.g. backtest MAPE (N8)
  insufficient_data  INTEGER NOT NULL DEFAULT 0 CHECK (insufficient_data IN (0, 1)),
  generated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_forecasts_lookup ON forecasts (store_product_id, horizon_days, generated_at);

CREATE TABLE recommendations (
  id                TEXT PRIMARY KEY,
  store_product_id  TEXT NOT NULL REFERENCES store_products(id),
  kind              TEXT NOT NULL CHECK (kind IN ('REORDER', 'EXPIRY_RISK', 'UNUSUAL_ACTIVITY')),
  suggested_qty     INTEGER CHECK (suggested_qty IS NULL OR suggested_qty >= 0),
  final_qty         INTEGER CHECK (final_qty IS NULL OR final_qty >= 0),
  reason            TEXT NOT NULL,                -- every recommendation is explained (F15)
  status            TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN ('PROPOSED', 'ACCEPTED', 'EDITED', 'REJECTED')),
  snapshot_version  INTEGER,
  model_version     TEXT,
  reviewer_id       TEXT REFERENCES users(id),
  reviewed_at       TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Purchase orders (M07)
-- ---------------------------------------------------------------------------
CREATE TABLE purchase_orders (
  id                        TEXT PRIMARY KEY,
  store_id                  TEXT NOT NULL REFERENCES stores(id),
  supplier_id               TEXT NOT NULL REFERENCES suppliers(id),
  status                    TEXT NOT NULL DEFAULT 'DRAFT'
                              CHECK (status IN ('DRAFT', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELED')),
  source_recommendation_id  TEXT REFERENCES recommendations(id),
  created_by                TEXT REFERENCES users(id),   -- NULL when drafted by the worker
  approved_by               TEXT REFERENCES users(id),
  supplier_confirmation     TEXT,
  created_at                TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approved_at               TEXT,
  sent_at                   TEXT
);
CREATE INDEX idx_orders_store_status ON purchase_orders (store_id, status);

CREATE TABLE purchase_order_lines (
  id                TEXT PRIMARY KEY,
  order_id          TEXT NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        TEXT NOT NULL REFERENCES products(id),
  qty               INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents  INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  received_qty      INTEGER NOT NULL DEFAULT 0 CHECK (received_qty >= 0)
);

-- ---------------------------------------------------------------------------
-- POS sales history (M04, M14): idempotent by external_event_id
-- ---------------------------------------------------------------------------
CREATE TABLE sales_events (
  id                 TEXT PRIMARY KEY,
  external_event_id  TEXT NOT NULL UNIQUE,
  store_id           TEXT NOT NULL REFERENCES stores(id),
  product_id         TEXT NOT NULL REFERENCES products(id),
  qty                INTEGER NOT NULL CHECK (qty > 0),
  sold_at            TEXT NOT NULL,
  received_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  result_json        TEXT NOT NULL               -- replayed events return this
);
CREATE INDEX idx_sales_history ON sales_events (store_id, product_id, sold_at);

-- ---------------------------------------------------------------------------
-- Audit trail (M13): append-only; same transaction as every stock change
-- ---------------------------------------------------------------------------
CREATE TABLE audit_events (
  id           TEXT PRIMARY KEY,
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('USER', 'SERVICE')),
  actor_id     TEXT NOT NULL,                    -- user id or service name
  store_id     TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  before_json  TEXT,
  after_json   TEXT,
  request_id   TEXT,
  at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_audit_entity ON audit_events (entity_type, entity_id);
CREATE INDEX idx_audit_store_time ON audit_events (store_id, at);

CREATE TRIGGER audit_events_append_only_update BEFORE UPDATE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER audit_events_append_only_delete BEFORE DELETE ON audit_events
BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;

-- ---------------------------------------------------------------------------
-- Alerts (M06, M12): one per store/type/resource/day, so the daily job is idempotent (T15)
-- ---------------------------------------------------------------------------
CREATE TABLE alerts (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id),
  alert_type   TEXT NOT NULL CHECK (alert_type IN
                 ('EXPIRED', 'EXPIRING_30', 'EXPIRING_60', 'EXPIRING_90', 'LOW_STOCK', 'REORDER', 'AI_RECOMMENDATION')),
  resource_id  TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'WARNING' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message      TEXT NOT NULL,
  alert_date   TEXT NOT NULL,                    -- store-local date the alert is for
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  viewed_at    TEXT,
  UNIQUE (store_id, alert_type, resource_id, alert_date)
);

-- ---------------------------------------------------------------------------
-- Customers and back-in-stock subscriptions (M15)
-- ---------------------------------------------------------------------------
CREATE TABLE customers (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE subscriptions (
  id                TEXT PRIMARY KEY,
  customer_id       TEXT NOT NULL REFERENCES customers(id),
  store_product_id  TEXT NOT NULL REFERENCES store_products(id),
  status            TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'NOTIFIED', 'UNSUBSCRIBED')),
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  notified_at       TEXT,
  UNIQUE (customer_id, store_product_id)
);

-- ---------------------------------------------------------------------------
-- Idempotency keys for receipts and supplier dispatch (DDS §4 "Mutation retries")
-- ---------------------------------------------------------------------------
CREATE TABLE idempotency_keys (
  scope          TEXT NOT NULL,                  -- e.g. 'RECEIPT', 'SUPPLIER_SEND'
  key            TEXT NOT NULL,
  request_hash   TEXT NOT NULL,                  -- same key + different payload => CONFLICT
  response_json  TEXT NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (scope, key)
);
