// M07 Suppliers and Purchase Orders: driver for draftOrder(lines) -> Order (DRAFT)
import type { DraftOrderInput } from "../modules/m07-ordering/service";
import { defineDriver, fixtures } from "./harness";

const sampleInput: DraftOrderInput = {
  storeId: "store-montclair",
  supplierId: "sup-acme",
  lines: [{ productId: "prod-lisin", qty: 30, unitPriceCents: 250 }],
};

export default defineDriver("M07 Suppliers and Purchase Orders", sampleInput, (ctx, input) =>
  ctx.ordering.draftOrder(fixtures.technician, input),
);
