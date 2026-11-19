/**
 * M02 Product Catalog (F4, F19, F22)
 * Subparts: ProductValidator, ProductRepository
 * Tests: T25, T26 · Iteration 1
 *
 * Rules: NDC is a non-empty unique STRING (leading zeros preserved, T25);
 * duplicate NDC -> CONFLICT, missing dosage form -> VALIDATION_ERROR (T26);
 * schedule class is validated on save, never inferred from free text (DDS §5.2);
 * deactivation hides the product from listings and public search.
 */
import type { Page, ProductView, ScheduleClass } from "@pharma/shared";
import { notImplemented } from "../../core/errors";
import type { Actor } from "../../core/types";
import type { Infra } from "../../context";
import type { AuditService } from "../m13-audit-reporting/service";

export interface ProductInput {
  ndc: string;
  brandName: string | null;
  genericName: string;
  strength: string;
  dosageForm: string;
  category: string;
  scheduleClass: ScheduleClass;
}

export type ProductPatch = Partial<ProductInput> & { active?: boolean };

export interface ProductQuery {
  q?: string;
  includeInactive: boolean;
  limit: number;
  cursor?: string;
}

export class CatalogService {
  constructor(
    private readonly infra: Infra,
    private readonly audit: AuditService,
  ) {}

  /** DDS: createProduct(dto) -> Product */
  createProduct(actor: Actor, input: ProductInput): ProductView {
    throw notImplemented("M02 create product");
  }

  /** DDS: updateProduct(id, patch) -> Product. `active: false` deactivates. */
  updateProduct(actor: Actor, productId: string, patch: ProductPatch): ProductView {
    throw notImplemented("M02 update product");
  }

  /** DDS: lookup(query) -> Products. Matches brand, generic or NDC. */
  lookup(query: ProductQuery): Page<ProductView> {
    throw notImplemented("M02 product lookup");
  }
}
