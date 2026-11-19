/**
 * M01 RolePolicy: store-scoped role-based access control (F1, DDS §9.1).
 *
 * `authorize(actor, action, storeId)` is the DDS M01 export. The server calls it
 * for EVERY state-changing operation; the UI hiding a button is never enough.
 */
import type { Role } from "@pharma/shared";
import { errors } from "../../core/errors";
import type { Actor, ServiceName } from "../../core/types";

export const ACTIONS = [
  "RECEIVE_STOCK",
  "VIEW_INVENTORY",
  "REQUEST_ADJUSTMENT",
  "APPROVE_ADJUSTMENT",
  "RECORD_DISPOSAL",
  "VIEW_EXPIRING",
  "VIEW_PRODUCTS",
  "MANAGE_PRODUCTS",
  "MANAGE_SUPPLIERS",
  "DRAFT_ORDER",
  "APPROVE_ORDER",
  "SEND_ORDER",
  "RECEIVE_ORDER",
  "VIEW_FORECASTS",
  "REVIEW_RECOMMENDATIONS",
  "VIEW_DASHBOARD",
  "EXPORT_REPORTS",
  "VIEW_AUDIT",
  "MANAGE_USERS",
  "MANAGE_STORES",
  "USE_CHAT",
  "INGEST_POS_SALES",
] as const;
export type Action = (typeof ACTIONS)[number];

const TECHNICIAN: readonly Action[] = [
  "RECEIVE_STOCK",
  "VIEW_INVENTORY",
  "REQUEST_ADJUSTMENT",
  "RECORD_DISPOSAL",
  "VIEW_EXPIRING",
  "VIEW_PRODUCTS",
  "DRAFT_ORDER",
  "RECEIVE_ORDER",
  "VIEW_FORECASTS", // read only; deciding is REVIEW_RECOMMENDATIONS
  "VIEW_DASHBOARD",
  "USE_CHAT",
];

/** Permission matrix (DDS §9.1). "As assigned" cells are granted by assigning an additional role. */
export const ROLE_PERMISSIONS: Record<Role, readonly Action[]> = {
  TECHNICIAN,
  PHARMACIST_MANAGER: [
    ...TECHNICIAN,
    "APPROVE_ADJUSTMENT",
    "MANAGE_PRODUCTS",
    "MANAGE_SUPPLIERS",
    "APPROVE_ORDER",
    "SEND_ORDER",
    "REVIEW_RECOMMENDATIONS",
    "EXPORT_REPORTS",
  ],
  SYSTEM_ADMIN: ["MANAGE_USERS", "MANAGE_STORES", "VIEW_AUDIT"],
};

/** Service identities used by jobs and adapters (DDS §3.2 "Jobs ... with service identity"). */
export const SERVICE_PERMISSIONS: Record<ServiceName, readonly Action[]> = {
  WORKER: ["VIEW_INVENTORY", "VIEW_EXPIRING", "VIEW_FORECASTS", "DRAFT_ORDER"],
  POS_ADAPTER: ["INGEST_POS_SALES"],
  AUTH: [],
};

export type Decision = { allowed: true } | { allowed: false; reason: "UNAUTHENTICATED" | "FORBIDDEN" };

/**
 * @param storeId the store the operation touches, or null for platform-wide
 *                operations (users, catalog). A role assignment with
 *                storeId = null applies to every store.
 */
export function authorize(actor: Actor | undefined, action: Action, storeId: string | null): Decision {
  if (!actor) return { allowed: false, reason: "UNAUTHENTICATED" };

  if (actor.kind === "SERVICE") {
    return SERVICE_PERMISSIONS[actor.serviceName].includes(action)
      ? { allowed: true }
      : { allowed: false, reason: "FORBIDDEN" };
  }

  const granted = actor.roles.some(
    (assignment) =>
      ROLE_PERMISSIONS[assignment.role].includes(action) &&
      (storeId === null || assignment.storeId === null || assignment.storeId === storeId),
  );
  return granted ? { allowed: true } : { allowed: false, reason: "FORBIDDEN" };
}

/** Throwing variant for services: UNAUTHENTICATED (401) or FORBIDDEN (403). */
export function assertAuthorized(actor: Actor | undefined, action: Action, storeId: string | null): Actor {
  const decision = authorize(actor, action, storeId);
  if (!decision.allowed) {
    throw decision.reason === "UNAUTHENTICATED" ? errors.unauthenticated() : errors.forbidden();
  }
  return actor as Actor;
}
