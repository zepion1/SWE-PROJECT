// M03 Stock Receiving: driver for receiveStock(...) -> Receipt (DDS Appendix A payload, T01)
import type { ReceiveStockInput } from "../modules/m03-receiving/service";
import { defineDriver, fixtures } from "./harness";

const sampleInput: ReceiveStockInput = {
  storeId: "store-montclair",
  productId: "prod-metf",
  supplierId: "sup-acme",
  lotNumber: "L-2409",
  expiresOn: "2027-04-30",
  quantity: 20,
};

export default defineDriver("M03 Stock Receiving and Lot Registry", sampleInput, (ctx, input) =>
  ctx.receiving.receiveStock(fixtures.technician, input, "receipt-7fc9"),
);
