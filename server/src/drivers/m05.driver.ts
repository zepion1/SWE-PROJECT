// M05 Adjustments and Cycle Counts: driver for requestAdjustment(lot, delta, reason) -> Request
import type { AdjustmentReasonCode } from "../modules/m05-adjustments/service";
import { defineDriver, fixtures } from "./harness";

const sampleInput = { lotId: "lot-amox-1", delta: -2, reasonCode: "DAMAGED" as AdjustmentReasonCode };

export default defineDriver("M05 Adjustments and Cycle Counts", sampleInput, (ctx, input) =>
  ctx.adjustments.requestAdjustment(fixtures.technician, input),
);
