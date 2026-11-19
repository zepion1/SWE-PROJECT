/**
 * Shared error catalog (DDS §4.2). The server maps each code to its HTTP status;
 * the client switches on `code`, never on the message text.
 */
export const ERROR_HTTP_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INSUFFICIENT_STOCK: 409,
  EXPIRED_LOT: 409,
  INTERNAL_ERROR: 500,
  /** Skeleton only: the endpoint exists but its module is not built yet. */
  NOT_IMPLEMENTED: 501,
  DEPENDENCY_UNAVAILABLE: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_HTTP_STATUS;

export const ERROR_CODES = Object.keys(ERROR_HTTP_STATUS) as ErrorCode[];
