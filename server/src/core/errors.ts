import { ERROR_HTTP_STATUS, type ErrorCode } from "@pharma/shared";

/**
 * The only error type services should throw on purpose. The HTTP error handler
 * turns it into the DDS §4.2 envelope; anything else becomes INTERNAL_ERROR.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }
}

/** Placeholder for functionality scheduled in a later iteration (see README roadmap). */
export function notImplemented(what: string): AppError {
  return new AppError("NOT_IMPLEMENTED", `${what} is not implemented yet`);
}

export const errors = {
  validation: (message: string, details?: unknown) => new AppError("VALIDATION_ERROR", message, details),
  unauthenticated: (message = "Sign in required") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "You do not have permission for this action") => new AppError("FORBIDDEN", message),
  notFound: (what: string) => new AppError("NOT_FOUND", `${what} not found`),
  conflict: (message: string, details?: unknown) => new AppError("CONFLICT", message, details),
  insufficientStock: (details?: unknown) =>
    new AppError("INSUFFICIENT_STOCK", "Requested quantity exceeds sellable stock", details),
  expiredLot: (details?: unknown) => new AppError("EXPIRED_LOT", "Expired stock cannot be sold", details),
  dependencyUnavailable: (dependency: string) =>
    new AppError("DEPENDENCY_UNAVAILABLE", `${dependency} is unavailable`),
};
