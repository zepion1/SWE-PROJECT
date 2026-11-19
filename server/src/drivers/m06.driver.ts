// M06 Expiration Management: driver for isSellable(lot, date) and the expiry classifier (T32 boundaries)
import { addDays } from "../core/clock";
import { classifyExpiry, isSellable } from "../modules/m06-expiration/service";
import { defineDriver } from "./harness";

const today = "2026-11-19";
const sampleInput = [-1, 0, 30, 31, 60, 61, 90, 91].map((days) => ({ days, expiresOn: addDays(today, days) }));

export default defineDriver("M06 Expiration Management", sampleInput, (_ctx, input) =>
  input.map(({ days, expiresOn }) => ({
    days,
    sellable: isSellable(expiresOn, today),
    bucket: classifyExpiry(expiresOn, today),
  })),
);
