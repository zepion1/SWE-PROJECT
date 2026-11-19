// M10 Public Catalog and Availability: driver for searchProducts(query, storeFilter) -> PublicSearchResult
import type { PublicSearchQuery } from "../modules/m10-public-catalog/service";
import { defineDriver } from "./harness";

const sampleInput: PublicSearchQuery = { q: "atorvastatin" };

export default defineDriver("M10 Public Catalog and Availability", sampleInput, (ctx, input) =>
  ctx.publicCatalog.searchProducts(input),
);
