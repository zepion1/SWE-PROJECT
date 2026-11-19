import { API_PREFIX, type ApiFailure, type ApiResponse, type ErrorCode } from "@pharma/shared";

/** Error thrown for any `{ error, requestId }` response. Switch on `code`, not on the message. */
export class ApiClientError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly requestId: string | null,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

let sessionToken: string | null = null;
let onSessionRejected: (() => void) | null = null;

/** Bearer token for staff requests; managed by AuthProvider. */
export function setSessionToken(token: string | null): void {
  sessionToken = token;
}

/** Called when the server rejects our session (expired, revoked, user locked). */
export function setSessionRejectedHandler(handler: (() => void) | null): void {
  onSessionRejected = handler;
}

/** Human-readable message, including the first field-level validation issue when present. */
export function describeError(err: unknown): string {
  if (err instanceof ApiClientError) {
    const issues = Array.isArray(err.details) ? (err.details as { path?: unknown[]; message?: string }[]) : [];
    const first = issues[0];
    if (err.code === "VALIDATION_ERROR" && first?.message) {
      const field = Array.isArray(first.path) && first.path.length ? `${first.path.join(".")}: ` : "";
      return `${field}${first.message}`;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (sessionToken) headers.Authorization = `Bearer ${sessionToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("DEPENDENCY_UNAVAILABLE", "Cannot reach the RedHawk server", null);
  }

  const json = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!json) throw new ApiClientError("INTERNAL_ERROR", `Unexpected response (${res.status})`, null);
  if ("error" in json) {
    const { error, requestId } = json as ApiFailure;
    if (error.code === "UNAUTHENTICATED" && headers.Authorization) onSessionRejected?.();
    throw new ApiClientError(error.code, error.message, requestId, error.details);
  }
  return json.data;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
