# AI-Driven Pharmaceutical Real-Time Inventory and Customer Information System

A centralized platform that connects participating pharmacies. Staff use it to manage lot-level inventory, expiration dates, suppliers and purchase orders. It also gives advisory, machine-learning demand forecasts, and offers a public portal where customers can check medication availability, cash prices and the nearest pharmacy.

> **Course:** CSIT 515 Software Engineering & Reliability, Fall 2026, Montclair State University
> **Team Seal-SIMD:** Maria Molano Escobar, Marko Maksuti, Ryan Petillo, Samuel Cordova
> **Stakeholder / Instructor:** Prof. Hubert Johnson

This is a classroom prototype. It uses **synthetic data only**. It implements technical safeguards inspired by HIPAA and DSCSA, but it makes **no claim of regulatory certification**.

---

## Table of contents

1. [Project documents](#project-documents)
2. [Scope](#scope)
3. [Users and roles](#users-and-roles)
4. [Functional requirements and module map](#functional-requirements-and-module-map)
5. [Non-functional targets](#non-functional-targets)
6. [Tech stack](#tech-stack)
7. [Repository layout](#repository-layout)
8. [Getting started](#getting-started)
9. [API conventions](#api-conventions)
10. [Core invariants](#core-invariants)
11. [Iteration roadmap](#iteration-roadmap)
12. [Testing](#testing)
13. [Development workflow](#development-workflow)
14. [Open decisions](#open-decisions)

---

## Project documents

| Document | Version | What it defines |
|---|---|---|
| Software Requirements Specification (SRS) | v0.3, Nov 10 2026 | Functional requirements **F1–F25**, non-functional requirements, roles, scope |
| Detailed Design Specification (DDS) | v0.1, Oct 29 2026 | Modules **M01–M16**, data model, API contracts, state machines, error catalog |
| Software Test Plan | Draft 0.2, Nov 12 2026 | Test groups **TP-01–TP-20**, test cases **T01–T66**, NFR IDs **N1–N9**, integration increments **I1–I7** |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | living | Mermaid diagrams of the system, modules, data model, workflows and state machines |

The PDFs are kept outside version control. The LaTeX sources are on the `docs` branch. Code, comments and tests use the IDs above (for example `F6`, `M04`, `T63`), so you can trace any line back to a requirement.

## Scope

**In scope**
- Inventory management for participating pharmacies: products, suppliers, lot-level stock, expiration management, purchase orders, reporting.
- AI/ML demand forecasting (7/30/90 days) and reorder recommendations. These are **advisory only**: a person always approves.
- Inventory updates from point-of-sale (POS) sales events.
- A customer-facing portal: medication search, coarse availability, cash price, nearest pharmacy.

**Out of scope** (SRS §1.2): prescription dispensing and e-prescribing, insurance claims, online payment, home delivery, and any medical or dosing advice.

## Users and roles

| Role | Can do | Cannot do |
|---|---|---|
| **Pharmacist / Manager** | Review inventory, verify counts, approve stock adjustments and purchase orders, accept/edit/reject AI recommendations, view reports | Manage users/stores |
| **Pharmacy Technician** | Receive stock, perform cycle counts, record discrepancies, read forecasts | Approve adjustments or orders |
| **Customer** (guest or registered) | Search products, see availability and cash price, find the nearest pharmacy; registered customers can subscribe to back-in-stock alerts | See exact quantities or Schedule II availability |
| **System Administrator** | Manage users, roles, stores, integrations, settings; review audit logs | Approve adjustments/orders (by default) |

Staff access is **store-scoped**: every operation is authorized for a specific store (DDS §9.1).

## Functional requirements and module map

Priorities use MoSCoW (SRS Table 3.1). The *Iteration* column refers to the [roadmap](#iteration-roadmap).

| ID | Function | Priority | Module(s) | Iteration |
|---|---|---|---|---|
| F1 | Staff sign-in with MFA and role-based access | Must | M01 | 1 |
| F2 | Customer search without account; optional registration | Should | M01, M15 | 5 |
| F3 | Audit log for every inventory change | Must | M04, M13 | 1–2 |
| F4 | Product records (name, NDC, strength, form, category, price) | Must | M02 | 1 |
| F5 | Receive stock by barcode/manual entry (lot, expiry, qty, supplier) | Must | M03 | 2 |
| F6 | POS sales reduce stock; manual corrections need approval | Must | M04, M05, M14 | 2, 4 |
| F7 | Real-time stock on hand by lot, with search/filter | Must | M04 | 2 |
| F8 | Cycle counts flag discrepancies | Should | M05 | 2 |
| F9 | Expiration dashboard (expired / 30 / 60 / 90 days) | Must | M06, M12 | 2–3 |
| F10 | Daily expiration alerts; block sale of expired stock | Must | M04, M06 | 2 |
| F11 | First-expired-first-out advice; disposal/return with dollar loss | Should | M06 | 2 |
| F12 | Supplier records and per-product reorder points | Must | M07 | 3 |
| F13 | Reorder alerts and draft purchase orders | Must | M07, M08 | 3 |
| F14 | Send approved orders; track Draft → Received; flag discrepancies | Should | M07 | 3 |
| F15 | Expiration-risk and unusual-activity warnings with explanations | Should | M08, M16 | 3, 6 |
| F16 | Demand forecasts for 7 / 30 / 90 days | Must | M09 | 4 |
| F17 | Reorder recommendations: accept / edit / reject | Must | M08, M09 | 3–4 |
| F18 | AI never changes stock or places orders without human approval | Must | M08, M16 | 3, 6 |
| F19 | Public search by brand/generic/NDC; In Stock / Low Stock / Out of Stock | Must | M10 | 5 |
| F20 | Retail cash price with "insurance pricing may differ" note | Must | M10 | 5 |
| F21 | Nearest pharmacies by consented location or ZIP, never stored | Must | M11 | 5 |
| F22 | Schedule II: show "Contact pharmacy for availability" | Must | M02, M10 | 1, 5 |
| F23 | Generic alternatives; back-in-stock notifications | Should | M15 | 5 |
| F24 | Pharmacist dashboard (low stock, expiring, pending orders, AI alerts) | Must | M12 | 3 |
| F25 | Exportable reports (value, movement, expiry losses, forecast accuracy) | Should | M13 | 3 |

### Modules (DDS §6)

| Module | Name | Responsibility | Code location |
|---|---|---|---|
| M01 | Identity and Authorization | Login + MFA, sessions, store-scoped RBAC | `server/src/modules/m01-identity` |
| M02 | Product Catalog | Product records, NDC validation, schedule class | `server/src/modules/m02-catalog` |
| M03 | Stock Receiving and Lot Registry | Idempotent receipts, lot matching | `server/src/modules/m03-receiving` |
| M04 | Stock Ledger and Sales | **Sole writer of stock deltas**; first-expired-first-out allocation; expired-lot block | `server/src/modules/m04-stock-ledger` |
| M05 | Adjustments and Cycle Counts | Pending → approved/rejected workflow | `server/src/modules/m05-adjustments` |
| M06 | Expiration Management | Expiry buckets, sellability, first-expired-first-out advice, disposal | `server/src/modules/m06-expiration` |
| M07 | Suppliers and Purchase Orders | Supplier records, purchase-order state machine, supplier adapter | `server/src/modules/m07-ordering` |
| M08 | Reorder Rules and Suggestions | Threshold engine, human-reviewed suggestions | `server/src/modules/m08-reorder` |
| M09 | Sales History and Forecasting | 7/30/90 baseline forecast, read-only | `server/src/modules/m09-forecasting` |
| M10 | Public Catalog and Availability | Safe public projection, availability classifier | `server/src/modules/m10-public-catalog` |
| M11 | Pharmacy Proximity | Distance ranking, no location persistence | `server/src/modules/m11-proximity` |
| M12 | Dashboard and Alerts | Dashboard aggregation, daily alert job | `server/src/modules/m12-dashboard` |
| M13 | Reporting and Audit | Append-only audit writer, CSV exports | `server/src/modules/m13-audit-reporting` |
| M14 | POS Integration Adapter | Signed, idempotent sale ingestion | `server/src/modules/m14-pos-adapter` |
| M15 | Customer Accounts and Notices | Registration, subscriptions, notifications | `server/src/modules/m15-customers` |
| M16 | AI Chat Interface | Read-only explanations with guardrails | `server/src/modules/m16-ai-chat` |

## Non-functional targets

| ID | Category | Target (SRS Table 3.2) |
|---|---|---|
| N1 | Performance | Customer search ≤ 2 s; inventory changes visible system-wide ≤ 5 s |
| N2 | Scalability | 100 pharmacies, 20,000 products/store, 1,000 concurrent customer sessions |
| N3 | Availability | 99.5% uptime; daily backups; recovery ≤ 4 h |
| N4 | Security | Encryption in transit and at rest; hashed passwords; tested against common web vulnerabilities |
| N5 | Privacy & compliance | HIPAA-style safeguards; DSCSA lot traceability; customer location used only with consent, never stored |
| N6 | Usability | Common staff tasks ≤ 3 clicks from dashboard; customer portal meets WCAG 2.1 AA |
| N7 | Reliability | Queue transactions during outages; sync on reconnect |
| N8 | AI quality | MAPE ≤ 20% for products with ≥ 6 months of history |
| N9 | Maintainability | Modular design, documented APIs, ≥ 70% automated test coverage |

Some targets, such as N2 at full scale and N3 uptime, can't be fully reproduced on course hardware. The Test Plan (§6) says how each one is measured and reported.

## Tech stack

The stack is chosen for simplicity. It closes Test Plan open question **Q1**.

| Layer | Choice | Why |
|---|---|---|
| Language | **TypeScript** everywhere | One language and shared types across client, server and tests |
| Frontend | **React** + Vite + React Router | Fast dev server, standard tooling |
| Backend | **Node.js** + Express | Small, well-known HTTP layer for the `/api/v1` REST/JSON contracts |
| Database | **SQLite** (via `better-sqlite3`) | Zero-setup file database; synchronous transactions make the stock ledger's atomicity rules straightforward |
| Validation | Zod | Request schemas that double as API documentation |
| Testing | Vitest + Supertest (+ Testing Library on the client) | One runner for unit/integration tests, built-in coverage for N9 |
| CI | GitHub Actions | Typecheck + tests on every pull request |

The deployment matches DDS §3.3: one backend process, one SQLite database file, and one background worker for daily alerts, forecasts and notifications.

## Repository layout

```
.
├── README.md
├── ARCHITECTURE.md            # Mermaid diagrams (system, modules, ERD, workflows)
├── package.json               # npm workspaces root
├── shared/                    # Types shared by client and server
│   └── src/                   #   API envelope, error codes, domain enums
├── server/                    # Express API + SQLite + background jobs
│   ├── src/
│   │   ├── app.ts             #   Express app factory
│   │   ├── index.ts           #   Server entry point
│   │   ├── core/              #   Errors, HTTP envelope, clock, ids, money
│   │   ├── db/                #   Connection, migrations, seed data
│   │   ├── modules/           #   M01–M16, one folder per DDS module
│   │   ├── adapters/          #   POS / supplier / map / mail / MFA ports + stubs
│   │   ├── jobs/              #   Background worker (daily alerts, forecasts)
│   │   └── drivers/           #   Module drivers required by DDS §10.1
│   └── tests/
└── client/                    # React app
    └── src/
        ├── api/               #   Typed API client
        ├── pages/staff/       #   Pharmacy operations views
        └── pages/public/      #   Customer portal views
```

## Getting started

### Prerequisites
- **Node.js 24** (see `.nvmrc`; run `nvm use`) and npm 10+
- No database server is needed: SQLite runs from a local file.

### Install and run

```bash
npm install            # installs all workspaces
npm run db:migrate     # creates ./server/data/pharmacy.db
npm run db:seed        # loads synthetic demo data
npm run dev            # API on http://localhost:3000, web app on http://localhost:5173
```

The Vite dev server forwards `/api` requests to the backend.

### Useful scripts (run from the repo root)

| Script | What it does |
|---|---|
| `npm run dev` | Start server and client together in watch mode |
| `npm run typecheck` | Type-check every workspace (the "compiles" gate for module drivers) |
| `npm test` | Run all unit and integration tests |
| `npm run test:coverage` | Tests with coverage report (target ≥ 70%, N9) |
| `npm run build` | Typecheck + production build of the client |
| `npm run db:migrate` / `npm run db:seed` | Apply schema migrations / load synthetic data |
| `npm run drivers` | Run the module drivers (DDS §10) |

### Environment variables (server)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | API port |
| `DATABASE_PATH` | `./data/pharmacy.db` | SQLite file (relative to `server/`) |
| `NODE_ENV` | `development` | `test` uses an in-memory database |

## API conventions

These conventions come from DDS §4. They apply to every endpoint under `/api/v1`.

- **Envelope:** a success returns `{ "data": ..., "requestId": "..." }`, and an error returns `{ "error": { "code", "message", "details" }, "requestId": "..." }`.
- **Error codes** (DDS §4.2):

  | Code | HTTP | Meaning |
  |---|---|---|
  | `VALIDATION_ERROR` | 400 | Missing, malformed or out-of-range field |
  | `UNAUTHENTICATED` | 401 | No valid staff session |
  | `FORBIDDEN` | 403 | Role or store access denied |
  | `NOT_FOUND` | 404 | Resource absent or hidden |
  | `CONFLICT` | 409 | Concurrent modification, duplicate or invalid state transition |
  | `INSUFFICIENT_STOCK` | 409 | Sale exceeds sellable quantity |
  | `EXPIRED_LOT` | 409 | Attempted sale of an expired lot |
  | `DEPENDENCY_UNAVAILABLE` | 503 | POS, supplier, forecast or map service down |
  | `INTERNAL_ERROR` | 500 | Unexpected failure (generic message + correlation ID) |
  | `NOT_IMPLEMENTED` | 501 | *Skeleton only*: endpoint not yet built |

- **Identifiers:** opaque UUID strings. NDC is always a **string**, so leading zeros are preserved.
- **Time:** timestamps are stored in UTC (ISO-8601). Expiration dates are calendar dates in the pharmacy's local timezone.
- **Money:** integer **cents**, never floating point.
- **Idempotency:** POS events, stock receipts and supplier dispatches carry an idempotency key or external event ID, so a replay never applies twice.
- **Pagination:** default page size 25, maximum 100.

The endpoint inventory is in DDS §8 and in [`ARCHITECTURE.md`](ARCHITECTURE.md#api-surface).

## Core invariants

Every change must preserve these rules (DDS §4.1, §9.2). Each one has at least one test.

1. **No negative stock.** Lot quantity is never below 0.
2. **Single writer.** Only the Stock Ledger (M04) changes `lots.qty_on_hand`.
3. **Append-only ledger and audit.** A correction is a new compensating movement, never an edit or deletion.
4. **Atomic audit.** A stock change and its audit event commit in one transaction. If the audit write fails, the stock change rolls back (fail closed).
5. **Expired lots are never sellable**, and this is enforced inside the sale transaction, not just in the UI.
6. **Exactly-once external events.** A replayed POS event or receipt key returns the original result.
7. **Humans approve.** Only a Pharmacist/Manager can move an adjustment or purchase order to *Approved*. AI output can only *propose*.
8. **Public privacy.** Customers never see exact quantities, never see Schedule II availability, and their location is never stored.

## Iteration roadmap

The build follows the Test Plan's dependency-driven integration increments (Test Plan §3.2). Each iteration is one or more pull requests and must leave `main` green.

| Iteration | Increment | Modules | Delivers | Key tests |
|---|---|---|---|---|
| **0** | Skeleton | all (stubs) | Monorepo, SQLite schema, route stubs, module drivers, CI | build + smoke tests |
| **1** | I1 Foundation | M01, M02, M13 audit writer | Login + MFA, RBAC, product catalog, audit writer | T06, T18, T21, T22, T25, T26 |
| **2** | I2 Inventory kernel | M03, M04, M05, M06 | Receiving, stock ledger + sales, adjustments, expiry blocking | T01–T04, T07, T08, T16, T27–T32, T63, T64 |
| **3** | I3 Operations | M07, M08, M12, M13 reports | Suppliers, purchase orders, reorder suggestions, dashboard, reports | T09, T15, T19, T36–T38, T41, T48, T49 |
| **4** | I4 Analytics & POS | M09, M14 | Baseline forecasts, POS adapter with replay safety | T05, T10, T11, T17, T40, T60, T66 |
| **5** | I5 Customer services | M10, M11, M15 | Public search, nearest pharmacy, subscriptions | T12–T14, T20, T23, T43–T47 |
| **6** | I6 AI interaction | M16 | Read-only chat with guardrails | T42 |
| **7** | I7 Full system | all | End-to-end, NFRs, acceptance scenarios A1–A6 | T50–T62 |

**Course milestones:** Nov 19 (final test plan and top-level code), Dec 2 (build freeze), Dec 3 (user manual draft), Dec 10 (demo and final submission).

## Testing

- **Unit tests** cover each module through its public exports, with mocked imports and a controllable clock for expiry and OTP boundaries.
- **Integration tests** call the real Express app against an in-memory SQLite database (`NODE_ENV=test`).
- **Module drivers** (`server/src/drivers/`) call each kernel module's exports with representative inputs and print a structured result, as DDS §10.1 requires.
- **Test case IDs:** name tests after Test Plan IDs, e.g. `it("T63: sells across lots first-expired-first-out", ...)`, so the traceability matrix (Test Plan §9) can be generated from test output.
- **Coverage:** `npm run test:coverage`; the target is ≥ 70% (N9).
- **CI:** GitHub Actions runs typecheck and tests on every pull request.

## Development workflow

1. Branch from `main` with a descriptive prefix: `feat/m04-stock-ledger`, `fix/…`, `test/…`, `documentation/…`. Don't use a `docs/` prefix: the existing `docs` branch blocks that namespace in git.
2. Keep pull requests focused: one module or one workflow per PR when possible.
3. Reference requirement, module and test IDs in the PR description (e.g. "Implements F5/M03; adds T01, T02, T27, T28").
4. CI must pass before merging. **Every PR is reviewed manually before it merges to `main`**, and a peer reviews another member's section, as the course requires.
5. Never commit real patient or customer data, secrets or `.env` files.

## Open decisions

These Test Plan §11.3 questions affect implementation. Record the team's decision here when each one is resolved.

| # | Question | Status / default used in code |
|---|---|---|
| Q1 | Stack, hosting, test tools | ✅ **Resolved:** TypeScript, React, Express, SQLite, Vitest |
| Q2 | Is a lot unsellable from the start or the end of its `expires_on` date? | Open. Skeleton default: unsellable **on** the expiry date |
| Q3 | Low Stock definition; same as reorder point? | Open. Separate `low_stock_threshold` and `reorder_point` columns |
| Q4 | May a manager approve their own adjustment? | Open. Skeleton default: **no** self-approval |
| Q6 | Minimum acceptable map/directions for F21 | Open. Proposed: ranked list plus external directions link |
| Q7 | Who views audit logs, through which endpoint? | Open. Proposed: System Administrator via `GET /api/v1/audit` |
| Q11 | Disposal dollar loss: unit cost or cash price? | Open. Schema stores both supplier unit cost and cash price |
| Q12 | Integration order; where does the audit writer land? | Proposed: M13 audit writer ships in Iteration 1 |
