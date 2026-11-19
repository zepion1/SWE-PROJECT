import { randomUUID } from "node:crypto";

/** Opaque UUID identifiers (DDS §4 "Identifiers"). */
export function newId(): string {
  return randomUUID();
}
