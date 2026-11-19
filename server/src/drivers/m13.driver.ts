// M13 Reporting and Audit: driver for recordAudit(event) -> void
import type { AuditEntry } from "../modules/m13-audit-reporting/service";
import { defineDriver, fixtures } from "./harness";

const sampleInput: AuditEntry = {
  actor: fixtures.manager,
  storeId: "store-montclair",
  action: "PRODUCT_UPDATED",
  entityType: "product",
  entityId: "prod-amox",
  before: { active: true },
  after: { active: false },
};

export default defineDriver("M13 Reporting and Audit", sampleInput, (ctx, input) => ctx.audit.record(input));
