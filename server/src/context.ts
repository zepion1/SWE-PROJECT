import type { Adapters } from "./adapters/ports";
import { createStubAdapters } from "./adapters/stubs";
import { systemClock, type Clock } from "./core/clock";
import type { Db } from "./db/connection";
import { IdentityService } from "./modules/m01-identity/service";
import { CatalogService } from "./modules/m02-catalog/service";
import { ReceivingService } from "./modules/m03-receiving/service";
import { StockLedgerService } from "./modules/m04-stock-ledger/service";
import { AdjustmentService } from "./modules/m05-adjustments/service";
import { ExpirationService } from "./modules/m06-expiration/service";
import { OrderingService } from "./modules/m07-ordering/service";
import { ReorderService } from "./modules/m08-reorder/service";
import { ForecastingService } from "./modules/m09-forecasting/service";
import { PublicCatalogService } from "./modules/m10-public-catalog/service";
import { ProximityService } from "./modules/m11-proximity/service";
import { DashboardService } from "./modules/m12-dashboard/service";
import { AuditService } from "./modules/m13-audit-reporting/service";
import { PosAdapterService } from "./modules/m14-pos-adapter/service";
import { CustomerService } from "./modules/m15-customers/service";
import { ChatService } from "./modules/m16-ai-chat/service";

/** Infrastructure every module receives. */
export interface Infra {
  db: Db;
  clock: Clock;
  adapters: Adapters;
}

/** The composition root: one instance of each module service, wired by dependency. */
export interface AppContext extends Infra {
  identity: IdentityService;
  catalog: CatalogService;
  receiving: ReceivingService;
  ledger: StockLedgerService;
  adjustments: AdjustmentService;
  expiration: ExpirationService;
  ordering: OrderingService;
  reorder: ReorderService;
  forecasting: ForecastingService;
  publicCatalog: PublicCatalogService;
  proximity: ProximityService;
  dashboard: DashboardService;
  audit: AuditService;
  pos: PosAdapterService;
  customers: CustomerService;
  chat: ChatService;
}

export function createContext(input: { db: Db; clock?: Clock; adapters?: Adapters }): AppContext {
  const infra: Infra = {
    db: input.db,
    clock: input.clock ?? systemClock,
    adapters: input.adapters ?? createStubAdapters(),
  };

  // Construction order follows the module dependency graph (ARCHITECTURE.md §4).
  const audit = new AuditService(infra);
  const identity = new IdentityService(infra, audit);
  const catalog = new CatalogService(infra, audit);
  const expiration = new ExpirationService(infra);
  const ledger = new StockLedgerService(infra, audit, expiration);
  const receiving = new ReceivingService(infra, ledger);
  const adjustments = new AdjustmentService(infra, ledger, audit);
  const ordering = new OrderingService(infra, audit);
  const forecasting = new ForecastingService(infra);
  const reorder = new ReorderService(infra, forecasting, ordering, audit);
  const publicCatalog = new PublicCatalogService(infra, expiration);
  const proximity = new ProximityService(infra, publicCatalog);
  const dashboard = new DashboardService(infra, expiration);
  const pos = new PosAdapterService(infra, ledger);
  const customers = new CustomerService(infra);
  const chat = new ChatService(infra, forecasting, reorder);

  return {
    ...infra,
    identity,
    catalog,
    receiving,
    ledger,
    adjustments,
    expiration,
    ordering,
    reorder,
    forecasting,
    publicCatalog,
    proximity,
    dashboard,
    audit,
    pos,
    customers,
    chat,
  };
}
