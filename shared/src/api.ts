import type { ErrorCode } from "./errors";

/** Every response carries the request ID so failures can be correlated with server logs. */
export interface ApiSuccess<T> {
  data: T;
  requestId: string;
}

export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiFailure {
  error: ApiErrorBody;
  requestId: string;
}

/** Response envelope (DDS §4): `{ data, requestId }` or `{ error, requestId }`. */
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export const API_PREFIX = "/api/v1";

/** Pagination limits (DDS §4). */
export const PAGE_SIZE_DEFAULT = 25;
export const PAGE_SIZE_MAX = 100;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface HealthStatus {
  status: "ok";
  db: "ok" | "error";
  version: string;
  time: string;
}
