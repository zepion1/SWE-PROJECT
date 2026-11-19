import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodType } from "zod";
import type { ApiFailure, ApiSuccess } from "@pharma/shared";
import { AppError, errors } from "./errors";

/** Attach a request ID (honouring an incoming X-Request-Id) for log correlation. */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};

/** Send a success envelope: `{ data, requestId }`. */
export function ok<T>(req: Request, res: Response, data: T, status = 200): void {
  const body: ApiSuccess<T> = { data, requestId: req.requestId };
  res.status(status).json(body);
}

/** Parse and validate input with a Zod schema; failures become VALIDATION_ERROR. */
export function parse<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw errors.validation("Request validation failed", result.error.issues);
  }
  return result.data;
}

/** A single, non-empty route parameter (e.g. `:storeId`). */
export function param(req: Request, name: string): string {
  const value: unknown = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw errors.validation(`Missing route parameter "${name}"`);
  }
  return value;
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(errors.notFound(`Route ${req.method} ${req.path}`));
};

/** Converts any thrown error into the DDS §4.2 envelope. Never leaks stack traces. */
export const errorHandler: ErrorRequestHandler = (err, req: Request, res: Response, _next: NextFunction) => {
  let appError: AppError;
  if (err instanceof AppError) {
    appError = err;
  } else if (err instanceof ZodError) {
    appError = errors.validation("Request validation failed", err.issues);
  } else if (err instanceof SyntaxError && "body" in err) {
    appError = errors.validation("Malformed JSON body");
  } else {
    console.error(`[${req.requestId}] unhandled error`, err);
    appError = new AppError("INTERNAL_ERROR", "An unexpected error occurred");
  }
  const body: ApiFailure = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details === undefined ? {} : { details: appError.details }),
    },
    requestId: req.requestId,
  };
  res.status(appError.httpStatus).json(body);
};
