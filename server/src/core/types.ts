import type { Role } from "@pharma/shared";

export interface RoleAssignment {
  role: Role;
  /** null = applies to every store (e.g. System Administrator). */
  storeId: string | null;
}

/** AUTH records sign-in attempts made before anyone is authenticated; it has no permissions. */
export type ServiceName = "WORKER" | "POS_ADAPTER" | "AUTH";

/** Who is performing an operation. Jobs and adapters act as a SERVICE identity (DDS §3.2). */
export type Actor =
  | { kind: "USER"; userId: string; email: string; roles: RoleAssignment[] }
  | { kind: "SERVICE"; serviceName: ServiceName };

/** ID written to audit_events.actor_id. */
export function actorId(actor: Actor): string {
  return actor.kind === "USER" ? actor.userId : actor.serviceName;
}

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      actor?: Actor;
      /** Raw JSON body, kept for signature verification (M14 POS events). */
      rawBody?: string;
    }
  }
}
