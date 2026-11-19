// M04 Stock Ledger and Sales: driver for applySale(storeId, productId, qty, eventId) -> SaleResult (Appendix B.4)
import type { SaleInput } from "../modules/m04-stock-ledger/service";
import { DRIVER_NOW, defineDriver, fixtures } from "./harness";

const sampleInput: SaleInput = {
  storeId: "store-montclair",
  productId: "prod-amox",
  qty: 1,
  externalEventId: "demo-1",
  soldAt: DRIVER_NOW,
};

export default defineDriver("M04 Stock Ledger and Sales", sampleInput, (ctx, input) =>
  ctx.ledger.applySale(fixtures.pos, input),
);
