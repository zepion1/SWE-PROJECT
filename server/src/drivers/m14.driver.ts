// M14 POS Integration Adapter: driver for ingestSale(externalId, payload) -> Acknowledgment
import type { PosSaleEvent } from "../modules/m14-pos-adapter/service";
import { DRIVER_NOW, defineDriver } from "./harness";

const sampleInput: PosSaleEvent = {
  externalEventId: "pos-demo-1",
  soldAt: DRIVER_NOW,
  lines: [{ productId: "prod-amox", qty: 1 }],
};

export default defineDriver("M14 POS Integration Adapter", sampleInput, (ctx, input) =>
  ctx.pos.ingestSale("store-montclair", input, JSON.stringify(input), "dev-signature"),
);
