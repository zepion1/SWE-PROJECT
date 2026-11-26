# RedHawk Pharmacy: Architecture

This document turns the Detailed Design Specification (DDS v0.1) into diagrams, applied to the chosen stack: **TypeScript · React · Express · SQLite**. Every diagram is Mermaid, which GitHub renders inline.

Module IDs (M01–M16), requirement IDs (F1–F25) and test IDs (T01–T66) match the SRS, DDS and Test Plan.

**Contents**

1. [System context](#1-system-context)
2. [Containers and deployment](#2-containers-and-deployment)
3. [Layered architecture and dependency rules](#3-layered-architecture-and-dependency-rules)
4. [Module map (M01–M16)](#4-module-map-m01m16)
5. [Data model](#5-data-model)
6. [Key workflows](#6-key-workflows)
7. [State machines](#7-state-machines)
8. [API surface](#api-surface)
9. [Security and privacy boundaries](#9-security-and-privacy-boundaries)
10. [Integration increments](#10-integration-increments)

---

## 1. System context

Who uses the system and which external systems it talks to. Every external system sits behind an adapter and can be replaced by a stub in tests.

```mermaid
flowchart LR
    pharm["Pharmacist / Manager"]
    tech["Pharmacy Technician"]
    admin["System Administrator"]
    cust["Customer<br/>(guest or registered)"]

    sys(["RedHawk Pharmacy<br/>Inventory and Customer Information System"])

    pos["POS system<br/>(simulator)"]
    sup["Supplier ordering<br/>(stub adapter)"]
    map["Map / geocoding<br/>(stub adapter)"]
    mail["Mail / notifications<br/>(stub adapter)"]
    mfa["MFA one-time codes<br/>(TOTP)"]

    pharm -- "approve adjustments, orders,<br/>AI recommendations" --> sys
    tech -- "receive stock, cycle counts" --> sys
    admin -- "users, roles, stores, audit" --> sys
    cust -- "search, availability, price,<br/>nearest pharmacy" --> sys

    pos -- "signed sale events" --> sys
    sys -- "approved purchase orders" --> sup
    sys -- "ZIP to coordinates, directions" --> map
    sys -- "back-in-stock notices, alerts" --> mail
    sys -- "verify one-time code" --> mfa
```

## 2. Containers and deployment

The semester prototype runs one backend process, one SQLite file and one worker (DDS §3.3). The React app is a single bundle with two route trees: staff and public.

```mermaid
flowchart TB
    subgraph browser["Browser"]
        staffUI["RedHawk staff app<br/>React routes /staff/*"]
        publicUI["RedHawk customer portal<br/>React routes /"]
    end

    subgraph server["Node.js process: server/"]
        api["Express API<br/>/api/v1/*"]
        mw["Middleware<br/>requestId, auth, RBAC, validation, errors"]
        mods["Application modules<br/>M01 to M16"]
        adapters["Adapters<br/>POS, supplier, map, mail, MFA"]
    end

    subgraph worker["Worker: server/src/jobs"]
        jobs["Scheduled jobs<br/>daily expiry alerts, reorder scan,<br/>forecasts, notifications"]
    end

    db[("SQLite<br/>server/data/pharmacy.db")]

    staffUI -- "HTTPS JSON" --> api
    publicUI -- "HTTPS JSON" --> api
    api --> mw --> mods
    mods --> db
    mods --> adapters
    jobs -- "service identity" --> mods
```

> **Why SQLite?** `better-sqlite3` gives synchronous, serializable transactions. That lets M04 check availability, post the issue and audit in one `db.transaction(...)` without any race, which covers T04 and T16. SQLite's single-writer model is fine at prototype scale. The repository layer keeps SQL in one place, so a later move to Postgres touches only that layer.

## 3. Layered architecture and dependency rules

Requests flow downward only. The UI never touches the database. Only the Stock Ledger writes stock quantities.

```mermaid
flowchart TB
    ui["React UI<br/>client/src"]
    http["HTTP layer<br/>routes.ts per module, Zod request schemas"]
    guard["Cross-cutting middleware<br/>requestId, authenticate, requireRole and store scope, error envelope"]
    svc["Application services<br/>service.ts per module"]
    ledger["M04 Stock Ledger<br/>sole writer of lot quantities"]
    audit["M13 Audit writer<br/>same transaction as the change"]
    repo["Data access<br/>better-sqlite3 prepared statements"]
    db[("SQLite")]
    ports["Adapter ports<br/>POS, supplier, map, mail, MFA"]

    ui -->|"HTTP API contracts only"| http
    http --> guard --> svc
    svc -->|"every stock delta"| ledger
    svc --> repo
    ledger --> audit
    ledger --> repo
    audit --> repo
    repo --> db
    svc --> ports
```

| Caller | May depend on | Must never |
|---|---|---|
| Staff UI / Customer UI | `/api/v1` HTTP contracts | Read the database or internal types beyond `shared/` |
| Inventory, Ordering, Expiration (M03, M05, M06, M07) | Catalog, stores, repository, auth context, audit, **M04 for any stock change** | Bypass document posting and audit |
| Public Search (M10, M11) | Public product projection, availability classifier, store lookup | Return quantities or Schedule II availability |
| Forecasting (M09) | Read-only sales history and inventory snapshots | Write stock or purchase orders |
| AI chat (M16) | Read-only forecast/recommendation queries | Mutate anything; proposals become review requests |
| Adapters | Published ports only | Write stock directly |
| Jobs | Application-service commands under a service identity | Bypass audit |

## 4. Module map (M01–M16)

Arrows read "depends on". Colors mark the DDS build packages: kernel K0, operational K1, analytics K2, extensions E1/E2.

```mermaid
flowchart LR
    subgraph K0["Kernel K0"]
        M01["M01 Identity and<br/>Authorization"]
        M02["M02 Product Catalog"]
        M03["M03 Receiving and<br/>Lot Registry"]
        M04["M04 Stock Ledger<br/>and Sales"]
        M05["M05 Adjustments and<br/>Cycle Counts"]
        M06["M06 Expiration<br/>Management"]
        M10["M10 Public Catalog<br/>and Availability"]
        M13["M13 Audit and<br/>Reporting"]
    end

    subgraph K1["Operational K1"]
        M07["M07 Suppliers and<br/>Purchase Orders"]
        M12["M12 Dashboard<br/>and Alerts"]
        M14["M14 POS Adapter"]
    end

    subgraph K2["Analytics K2"]
        M08["M08 Reorder Rules<br/>and Suggestions"]
        M09["M09 Sales History<br/>and Forecasting"]
    end

    subgraph EXT["Extensions E1 / E2"]
        M11["M11 Pharmacy<br/>Proximity"]
        M15["M15 Customer Accounts<br/>and Notices"]
        M16["M16 AI Chat"]
    end

    M02 --> M01
    M02 --> M13
    M03 --> M02
    M03 --> M04
    M04 --> M13
    M05 --> M04
    M05 --> M01
    M06 --> M04
    M07 --> M01
    M07 --> M02
    M07 --> M13
    M08 --> M07
    M08 --> M09
    M09 -. "read-only" .-> M04
    M10 --> M02
    M10 -. "read-only" .-> M04
    M11 --> M10
    M12 --> M06
    M12 --> M07
    M12 --> M08
    M14 --> M04
    M15 --> M10
    M16 -. "read-only" .-> M08
    M16 -. "read-only" .-> M09

    classDef kernel fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
    classDef ops fill:#dcfce7,stroke:#15803d,color:#0f172a
    classDef analytics fill:#fef9c3,stroke:#a16207,color:#0f172a
    classDef ext fill:#f3e8ff,stroke:#7e22ce,color:#0f172a
    class M01,M02,M03,M04,M05,M06,M10,M13 kernel
    class M07,M12,M14 ops
    class M08,M09 analytics
    class M11,M15,M16 ext
```

Each module lives in `server/src/modules/mNN-<name>/` and has the same shape:

| File | Contents |
|---|---|
| `service.ts` | Exported functions and classes with the DDS signatures, e.g. `applySale(storeId, productId, qty, eventId)` |
| `routes.ts` | Express router for the module's `/api/v1` endpoints, with Zod request schemas |
| `*.test.ts` (in `server/tests/`) | Unit and integration tests named after Test Plan IDs |
| `drivers/mNN.driver.ts` | DDS §10 module driver: calls exports with mocked imports and prints a structured result |

## 5. Data model

This model implements DDS §5 directly. Money is stored as integer cents and timestamps as ISO-8601 UTC strings. `expires_on` is a store-local calendar date (`YYYY-MM-DD`).

```mermaid
erDiagram
    STORE ||--o{ STORE_PRODUCT : lists
    PRODUCT ||--o{ STORE_PRODUCT : "is listed as"
    STORE_PRODUCT ||--o{ LOT : "stocked in"
    SUPPLIER ||--o{ LOT : supplies
    LOT ||--o{ DOCUMENT_LINE : "received or issued"
    DOCUMENT ||--|{ DOCUMENT_LINE : contains
    LOT ||--o{ ADJUSTMENT_REQUEST : "corrected by"
    STORE ||--o{ PURCHASE_ORDER : places
    SUPPLIER ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--|{ PURCHASE_ORDER_LINE : contains
    PRODUCT ||--o{ PURCHASE_ORDER_LINE : "ordered as"
    SUPPLIER ||--o{ SUPPLIER_PRODUCT : prices
    PRODUCT ||--o{ SUPPLIER_PRODUCT : "priced by"
    STORE ||--o{ SALES_EVENT : records
    PRODUCT ||--o{ SALES_EVENT : "sold as"
    STORE_PRODUCT ||--o{ FORECAST : "forecast for"
    STORE_PRODUCT ||--o{ RECOMMENDATION : "advised for"
    USER ||--o{ ROLE_ASSIGNMENT : holds
    STORE ||--o{ ROLE_ASSIGNMENT : scopes
    USER ||--o{ SESSION : "signs in with"
    STORE ||--o{ ALERT : raises
    CUSTOMER ||--o{ SUBSCRIPTION : creates
    STORE_PRODUCT ||--o{ SUBSCRIPTION : "watched by"

    STORE {
        string id PK
        string name
        string address
        string postal_code
        float latitude
        float longitude
        string timezone
        int active
    }
    USER {
        string id PK
        string email UK
        string password_hash
        string mfa_secret
        int mfa_enabled
        string status "ACTIVE LOCKED DISABLED"
    }
    ROLE_ASSIGNMENT {
        string id PK
        string user_id FK
        string store_id FK "null means all stores"
        string role "PHARMACIST_MANAGER TECHNICIAN SYSTEM_ADMIN"
    }
    SESSION {
        string id PK
        string user_id FK
        string token_hash UK
        string expires_at
    }
    PRODUCT {
        string id PK
        string ndc UK "string, leading zeros kept"
        string brand_name
        string generic_name
        string strength
        string dosage_form
        string category
        string schedule_class "NONE II III IV V"
        int active
    }
    STORE_PRODUCT {
        string id PK
        string store_id FK
        string product_id FK
        int cash_price_cents
        int reorder_point
        int low_stock_threshold
        int active
    }
    SUPPLIER {
        string id PK
        string name
        string contact_email
        string contact_phone
        int lead_days
        int minimum_order_cents
        int active
    }
    SUPPLIER_PRODUCT {
        string id PK
        string supplier_id FK
        string product_id FK
        int unit_cost_cents
    }
    LOT {
        string id PK
        string store_product_id FK
        string supplier_id FK
        string lot_number
        string expires_on "store-local date"
        string status "ACTIVE QUARANTINED DEPLETED EXPIRED"
        int version "optimistic concurrency"
    }
    DOCUMENT_LINE {
        string id PK
        string document_id FK
        string lot_id FK
        int quantity
    }
    ADJUSTMENT_REQUEST {
        string id PK
        string lot_id FK
        int requested_delta
        string reason_code
        string status "PENDING APPROVED REJECTED"
        int expected_version
        string requested_by
        string reviewed_by
    }
    PURCHASE_ORDER {
        string id PK
        string store_id FK
        string supplier_id FK
        string status
        string created_by
        string approved_by
        string created_at
    }
    PURCHASE_ORDER_LINE {
        string id PK
        string order_id FK
        string product_id FK
        int qty
        int unit_price_cents
        int received_qty
    }
    SALES_EVENT {
        string id PK
        string external_event_id UK "replay safety"
        string store_id FK
        string product_id FK
        int qty
        string sold_at
    }
    FORECAST {
        string id PK
        string store_product_id FK
        int horizon_days "7 30 90"
        float predicted_units
        string model_version
        string generated_at
    }
    RECOMMENDATION {
        string id PK
        string store_product_id FK
        string kind "REORDER EXPIRY_RISK UNUSUAL_ACTIVITY"
        int suggested_qty
        string reason
        string status "PROPOSED ACCEPTED EDITED REJECTED"
        string reviewer_id
    }
    AUDIT_EVENT {
        string id PK
        string actor_id
        string store_id
        string action
        string entity_type
        string entity_id
        string before_json
        string after_json
        string at
    }
    ALERT {
        string id PK
        string store_id FK
        string alert_type
        string resource_id
        string severity
        string alert_date "unique per day"
    }
    CUSTOMER {
        string id PK
        string email UK
        string password_hash
    }
    SUBSCRIPTION {
        string id PK
        string customer_id FK
        string store_product_id FK
        string status "ACTIVE NOTIFIED UNSUBSCRIBED"
    }
    IDEMPOTENCY_KEY {
        string scope PK
        string key PK
        string request_hash
        string response_json
    }
```

**Constraints the database enforces** (DDS §5.2):
- Check calculated lot availability before committing an issue, `CHECK (qty > 0)` on order lines and sales, `CHECK (cash_price_cents >= 0)`, `CHECK (horizon_days IN (7, 30, 90))`.
- `UNIQUE (store_product_id, lot_number, supplier_id)` on `lot`. `UNIQUE (external_event_id)` on `sales_event`.
- `UNIQUE (store_id, alert_type, resource_id, alert_date)` on `alert`, so the daily job is idempotent (T15).
- Audit entries are append-only. A manager corrects an erroneous GRN line with a reason and before/after audit in one transaction. The stock view sums GRN quantities minus GIN quantities per store, product and lot. A later delivery creates a second GRN linked to the same invoice.
- `AUDIT_EVENT` points to its target by `(entity_type, entity_id)` rather than a foreign key, so it isn't coupled to every table.
- `SESSION`, `SUPPLIER_PRODUCT` and `IDEMPOTENCY_KEY` aren't listed in DDS §5. They support M01 sessions, F12 supplier prices, and idempotent receipts (T02).

## 6. Key workflows

### UC-01 Receive stock (F5, T01, T02, T27, T28)

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Technician
    participant API as Receipts API
    participant M01 as M01 Auth
    participant M03 as M03 Receiving
    participant M04 as M04 Stock Ledger
    participant M13 as M13 Audit
    participant DB as SQLite

    Tech->>API: lot, expiresOn, qty, supplier + Idempotency-Key
    API->>M01: authorize(actor, RECEIVE_STOCK, storeId)
    M01-->>API: allowed
    API->>M03: receiveStock(...)
    M03->>DB: lookup idempotency key
    alt key already used with same payload
        DB-->>M03: stored response
        M03-->>API: original receipt, no second increase
    else new key
        M03->>M03: validate qty > 0, expiry, lot consistency
        M03->>M04: applyReceipt(lot, +qty)
        activate M04
        Note over M04,DB: BEGIN TRANSACTION
        M04->>DB: validate lot and identify receipt line
        M04->>DB: record receipt once; verifying an existing GRN adds no units
        M04->>M13: recordAudit(RECEIPT, before, after)
        M13->>DB: insert audit_event
        M04->>DB: store idempotency response
        Note over M04,DB: COMMIT, or ROLLBACK on any failure
        deactivate M04
        M04-->>API: receipt summary
    end
    API-->>Tech: 200 data + requestId
```

### UC-02 POS sale, the atomic first-expired-first-out allocation (F6, F10, T03, T04, T05, T63, T64)

```mermaid
sequenceDiagram
    autonumber
    participant POS as POS simulator
    participant M14 as M14 POS Adapter
    participant M04 as M04 Stock Ledger
    participant M13 as M13 Audit
    participant DB as SQLite

    POS->>M14: sale event (externalId, lines, signature)
    M14->>M14: verify signature and schema
    alt bad signature or payload
        M14-->>POS: rejected and logged (T17)
    else valid
        M14->>M04: applySale(storeId, productId, qty, externalId)
        Note over M04,DB: BEGIN IMMEDIATE TRANSACTION
        M04->>DB: sales_event with externalId exists?
        alt replayed event
            DB-->>M04: previous result
            M04-->>M14: original result, no second decrement (T05)
        else new event
            M04->>DB: select ACTIVE lots with qty > 0 and expires_on after store-local today, ordered by expires_on then id
            alt sellable total below qty
                M04->>DB: ROLLBACK
                M04-->>M14: INSUFFICIENT_STOCK or EXPIRED_LOT (T03, T64)
            else enough stock
                loop each lot until qty is covered
                    M04->>DB: insert GIN line for allocated lot
                end
                M04->>DB: insert sales_event
                M04->>M13: recordAudit(SALE)
                M04->>DB: COMMIT
                M04-->>M14: sale result (T63)
            end
        end
        M14-->>POS: acknowledgment
    end
```

### UC-03 Manual correction with manager approval (F6, F8, T06, T07, T29, T31)

```mermaid
sequenceDiagram
    autonumber
    actor Tech as Technician
    actor Mgr as Pharmacist / Manager
    participant M05 as M05 Adjustments
    participant M04 as M04 Stock Ledger
    participant DB as SQLite

    Tech->>M05: requestAdjustment(lot, delta, reason) or cycle count
    M05->>DB: insert adjustment_request PENDING, expected_version = lot.version
    M05-->>Tech: pending request, stock unchanged

    Mgr->>M05: approveAdjustment(id, decision)
    M05->>M05: require PHARMACIST_MANAGER for this store
    M05->>M05: reject self-approval (Q4 default)
    alt request not PENDING
        M05-->>Mgr: CONFLICT, already reviewed (T29)
    else lot.version changed since request
        M05-->>Mgr: CONFLICT, recount required
    else APPROVE
        M05->>M04: applyAdjustment(lot, delta) in one transaction
        M04-->>M05: ok, or INSUFFICIENT_STOCK if the result would go negative
        M05->>DB: status APPROVED, reviewed_by
    else REJECT
        M05->>DB: status REJECTED, stock unchanged
    end
    M05-->>Mgr: final status
```

### UC-05 and UC-08 Reorder suggestion and forecast review (F13, F16, F17, F18, T10, T37, T41)

```mermaid
sequenceDiagram
    autonumber
    participant Job as Worker job
    participant M08 as M08 Reorder
    participant M09 as M09 Forecasting
    participant M07 as M07 Purchase Orders
    actor Mgr as Pharmacist / Manager
    participant Sup as Supplier adapter

    Job->>M08: evaluateReorder(storeProductId)
    M08->>M09: forecast(storeProductId, 30)
    alt forecast service unavailable
        M09-->>M08: DEPENDENCY_UNAVAILABLE
        M08->>M08: fall back to reorder_point threshold (T66)
    else forecast ok
        M09-->>M08: predicted units + model version
    end
    M08->>M08: suggested qty = max(0, target - sellable qty)
    M08-->>Job: Recommendation PROPOSED with reason
    Note over M08: AI output never writes stock or orders (F18)

    Mgr->>M08: reviewSuggestion(id, ACCEPT, EDIT or REJECT, qty)
    alt ACCEPT or EDIT
        M08->>M07: draftOrder(lines)
        M07-->>Mgr: purchase order DRAFT
        Mgr->>M07: approveOrder(id)
        M07->>Sup: sendOrder(id), only when APPROVED
        Sup-->>M07: SENT, or retry on failure (T65)
    else REJECT
        M08-->>Mgr: recorded, nothing ordered
    end
```

### UC-06 and UC-07 Public search and nearest pharmacy (F19 to F22, T12, T13, T43 to T46)

```mermaid
sequenceDiagram
    autonumber
    actor C as Customer
    participant M10 as M10 Public Catalog
    participant M11 as M11 Proximity
    participant Map as Map adapter

    C->>M10: GET /public/search?q=brand, generic or NDC
    M10->>M10: normalize query, exclude inactive listings
    loop each matching product and store
        alt schedule_class is II
            M10->>M10: availability = "Contact pharmacy for availability"
        else other products
            M10->>M10: sellable qty from unexpired ACTIVE lots
            M10->>M10: classify as In Stock, Low Stock or Out of Stock
        end
    end
    M10-->>C: name, availability, cash price, insurance note, generic alternatives. No quantities.

    C->>M11: GET /public/nearby?productId and ZIP or consented lat/lng
    M11->>Map: resolve ZIP to coordinates (in memory only)
    M11->>M11: filter stores In Stock, sort by distance, stable tie order
    M11-->>C: ranked stores + directions links. Origin is never stored or logged.
```

### Daily expiration job (F9, F10, T15, T32, T33)

```mermaid
flowchart LR
    start(["Worker: daily at store-local 00:05"]) --> scan["Select lots with qty > 0"]
    scan --> calc["daysLeft = expires_on minus store-local today"]
    calc --> b{"daysLeft"}
    b -- "less than 0" --> e["EXPIRED: set lot status EXPIRED"]
    b -- "0 to 30" --> w30["EXPIRING_30"]
    b -- "31 to 60" --> w60["EXPIRING_60"]
    b -- "61 to 90" --> w90["EXPIRING_90"]
    b -- "over 90" --> skip["no alert"]
    e --> up["Upsert alert, unique per store, type, lot and date"]
    w30 --> up
    w60 --> up
    w90 --> up
    up --> notify["Notify that store's Pharmacist/Manager and Technician"]
```

## 7. State machines

These diagrams implement DDS §7.1. A transition that isn't drawn is rejected with `CONFLICT`.

### Adjustment request

```mermaid
stateDiagram-v2
    [*] --> PENDING: technician or manager submits
    PENDING --> APPROVED: manager approves, M04 applies the delta once
    PENDING --> REJECTED: manager rejects, stock unchanged
    APPROVED --> [*]
    REJECTED --> [*]
```

### Purchase order

```mermaid
stateDiagram-v2
    [*] --> DRAFT: created manually or from an accepted recommendation
    DRAFT --> APPROVED: Pharmacist / Manager only
    DRAFT --> CANCELED
    APPROVED --> SENT: supplier adapter confirms, retry safe
    SENT --> PARTIALLY_RECEIVED: delivery short, discrepancy flagged
    SENT --> RECEIVED: delivery complete
    PARTIALLY_RECEIVED --> RECEIVED: remainder delivered
    CANCELED --> [*]
    RECEIVED --> [*]
```

### Recommendation (AI advisory output)

```mermaid
stateDiagram-v2
    [*] --> PROPOSED: M08 or M09 generates, with reason
    PROPOSED --> ACCEPTED: pharmacist accepts, draft order created
    PROPOSED --> EDITED: pharmacist changes qty, draft order created
    PROPOSED --> REJECTED: pharmacist rejects
    ACCEPTED --> [*]
    EDITED --> [*]
    REJECTED --> [*]
    note right of PROPOSED
        No path from any recommendation
        state to a stock change or a sent order.
    end note
```

### Lot

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: received with future expiry
    [*] --> QUARANTINED: received already expired or flagged
    ACTIVE --> DEPLETED: qty reaches 0
    ACTIVE --> EXPIRED: daily job or sale-time check
    ACTIVE --> QUARANTINED: recall or discrepancy
    QUARANTINED --> ACTIVE: authorized review
    DEPLETED --> ACTIVE: stock added to the same lot
    EXPIRED --> [*]: disposed or returned
    note right of EXPIRED
        Never sellable. M04 also re-checks
        expires_on inside every sale.
    end note
```

## API surface

All paths are prefixed with `/api/v1` (DDS §8). Responses use the `{ data, requestId }` / `{ error, requestId }` envelope. ✅ marks endpoints that are implemented; the rest return `501 NOT_IMPLEMENTED` until their iteration.

| Method | Path | Owner | Auth | Notes |
|---|---|---|---|---|
| GET | `/health` | core | public | Liveness + DB check |
| POST | `/auth/login` | M01 | public | ✅ email + password + one-time code in one request; 5 failures lock the account |
| POST | `/auth/logout` | M01 | staff | ✅ Revokes the session |
| GET | `/auth/me` | M01 | staff | ✅ Current actor + role assignments |
| GET | `/stores` | M01 | staff | ✅ Caller's stores (all stores for admins) |
| GET | `/admin/users` | M01 | admin | ✅ List staff accounts |
| POST | `/admin/users` | M01 | admin | ✅ Create staff account, assign roles; returns TOTP setup once |
| POST | `/admin/users/:id/unlock` | M01 | admin | ✅ Unlock a locked account |
| GET | `/products` | M02 | staff | ✅ Search brand/generic/NDC, `includeInactive`, cursor pagination |
| GET | `/products/:id` | M02 | staff | ✅ One product, including inactive |
| POST | `/products` | M02 | manager | ✅ Create product (duplicate NDC → 409) |
| PATCH | `/products/:id` | M02 | manager | ✅ Update, deactivate (`active: false`) or reactivate |
| POST | `/stores/:storeId/receipts` | M03 | tech/manager | `Idempotency-Key` header |
| GET | `/stores/:storeId/inventory` | M04 | tech/manager | Per-lot stock, filters |
| POST | `/stores/:storeId/sales-events` | M14 | POS service | Signed, idempotent by external ID |
| POST | `/adjustments` | M05 | tech/manager | Creates PENDING |
| POST | `/adjustments/:id/approve` | M05 | manager | `{ decision, expectedVersion }` |
| POST | `/stores/:storeId/cycle-counts` | M05 | tech/manager | Flags differences |
| GET | `/stores/:storeId/expiring?days=30` | M06 | tech/manager | days ∈ {30, 60, 90} |
| POST | `/stores/:storeId/disposals` | M06 | tech/manager | Records dollar loss |
| GET/POST | `/suppliers` | M07 | manager | Supplier records |
| POST | `/orders` | M07 | tech/manager | Creates DRAFT |
| POST | `/orders/:id/approve` | M07 | manager | |
| POST | `/orders/:id/send` | M07 | manager | Only from APPROVED |
| POST | `/orders/:id/receipts` | M07 | tech/manager | Partial or full delivery |
| GET | `/forecast/:storeProductId?days=30` | M09 | staff | Advisory only |
| GET | `/stores/:storeId/recommendations` | M08 | staff | |
| POST | `/recommendations/:id/review` | M08 | manager | accept / edit / reject |
| GET | `/stores/:storeId/dashboard` | M12 | staff | Low stock, expiring, pending orders, AI alerts |
| GET | `/stores/:storeId/reports?type=&from=&to=` | M13 | manager | CSV export |
| GET | `/audit` | M13 | admin | ✅ Newest first; filter by store, entity, date (Q7 proposal) |
| GET | `/public/search?q=` | M10 | public | No quantities, Schedule II masked |
| GET | `/public/nearby?productId=&zip=` | M11 | public | Location never stored |
| POST | `/public/customers` | M15 | public | Optional registration |
| POST | `/public/subscriptions` | M15 | customer | Back-in-stock notice |
| DELETE | `/public/subscriptions/:id` | M15 | customer | Unsubscribe |
| POST | `/chat` | M16 | staff | Read-only answers |

Rows not listed in DDS §8 (logout, me, stores, admin users, unlock, product by id, cycle counts, disposals, suppliers, send, order receipts, recommendations list, audit, customer endpoints, chat) are proposed additions. Each one is needed by a requirement the DDS assigns to the owning module.

## 9. Security and privacy boundaries

```mermaid
flowchart LR
    subgraph public["Public zone: no session"]
        c["Customer portal"]
        ps["/public/* routes"]
    end
    subgraph staff["Staff zone: session + MFA"]
        s["Staff app"]
        sr["/stores/:storeId/*, /orders, /adjustments, ..."]
        rbac{"requireRole + store scope"}
    end
    subgraph core["Trusted core"]
        svc["Services"]
        led["M04 Ledger + M13 Audit<br/>one transaction"]
        db[("SQLite")]
    end
    pos["POS"] -- "HMAC-signed events" --> sr

    c --> ps -- "projection: no qty,<br/>Schedule II masked,<br/>location in memory only" --> svc
    s --> sr --> rbac -- "allowed" --> svc
    rbac -- "denied: 401 / 403" --> s
    svc --> led --> db
```

**Permission matrix** (DDS §9.1). The server enforces it on every request.

| Operation | Technician | Pharmacist / Manager | System Admin | Customer |
|---|---|---|---|---|
| Receive stock | ✅ | ✅ | as assigned | ❌ |
| Approve adjustments | ❌ | ✅ | ❌ by default | ❌ |
| Approve purchase orders | ❌ | ✅ | ❌ by default | ❌ |
| View detailed lots | ✅ | ✅ | as assigned | ❌ |
| Public search | ✅ | ✅ | ✅ | ✅ |
| Manage users / stores | ❌ | ❌ | ✅ | ❌ |
| Review forecasts | read | decide | as assigned | ❌ |

**Implementation notes**
- Passwords are hashed with `scrypt` (Node `crypto`) and a per-user salt. MFA uses TOTP one-time codes, with a stub provider in tests.
- Session tokens are random. Only their hash is stored.
- The DDS §4.2 error envelope returns no stack traces. `INTERNAL_ERROR` carries the correlation `requestId`.
- Request logs drop `lat`, `lng` and `zip` query parameters (F21, T57).
- CSV exports escape cells that start with `=`, `+`, `-` or `@` (T49).
- Encryption at rest (N4) is out of scope for the SQLite prototype. It's documented as a gap with options: SQLCipher or an encrypted volume.

## 10. Integration increments

Implementation and testing grow outward from the inventory kernel (Test Plan §3.2). The audit writer from M13 ships in I1, because the kernel commits every stock delta together with its audit event (proposed answer to Q12).

```mermaid
flowchart TB
    I0["Iteration 0: Skeleton<br/>schema, route stubs, drivers, CI"]
    I1["I1 Foundation<br/>M01 Identity, M02 Catalog, M13 audit writer"]
    I2["I2 Inventory kernel<br/>M03 Receiving, M04 Ledger, M05 Adjustments, M06 Expiration"]
    I3["I3 Operations<br/>M07 Orders, M08 Reorder, M12 Dashboard, M13 Reports"]
    I4["I4 Analytics and POS<br/>M09 Forecasting, M14 POS Adapter"]
    I5["I5 Customer services<br/>M10 Public Catalog, M11 Proximity, M15 Customers"]
    I6["I6 AI interaction<br/>M16 AI Chat"]
    I7["I7 Full system<br/>end-to-end, NFR N1 to N9, acceptance A1 to A6"]

    I0 --> I1 --> I2 --> I3 --> I4 --> I5 --> I6 --> I7

    style I2 fill:#dbeafe,stroke:#1d4ed8,color:#0f172a
```
