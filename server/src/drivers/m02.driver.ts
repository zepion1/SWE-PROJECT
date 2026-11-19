// M02 Product Catalog: driver for createProduct(dto) -> Product (leading-zero NDC, T25)
import type { ProductInput } from "../modules/m02-catalog/service";
import { defineDriver, fixtures } from "./harness";

const sampleInput: ProductInput = {
  ndc: "09999-0701-30",
  brandName: null,
  genericName: "Levothyroxine",
  strength: "50 mcg",
  dosageForm: "Tablet",
  category: "Endocrine",
  scheduleClass: "NONE",
};

export default defineDriver("M02 Product Catalog", sampleInput, (ctx, input) =>
  ctx.catalog.createProduct(fixtures.manager, input),
);
