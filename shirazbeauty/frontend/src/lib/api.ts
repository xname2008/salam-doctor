import { getToken } from "@/lib/auth";

/**
 * Baked in at build time by the `NEXT_PUBLIC_API_URL` build arg (see the
 * frontend Dockerfile). The fallback keeps `next dev` working without a .env.
 */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010/api/v1"
).replace(/\/+$/, "");

const DEFAULT_TIMEOUT_MS = 15_000;

/** A failed request, normalised so callers never have to inspect a raw Response. */
export class ApiError extends Error {
  readonly status: number;
  /** Populated from a 429's `Retry-After` header. */
  readonly retryAfter?: number;
  /** Field-level messages from a FastAPI 422, keyed by field name. */
  readonly fieldErrors?: Record<string, string>;

  constructor(
    message: string,
    status: number,
    options: { retryAfter?: number; fieldErrors?: Record<string, string> } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.retryAfter = options.retryAfter;
    this.fieldErrors = options.fieldErrors;
  }

  /** True when the request never reached the server. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

interface FastApiValidationIssue {
  loc: (string | number)[];
  msg: string;
  type: string;
}

/**
 * FastAPI returns `{detail: "..."}` for raised HTTPExceptions but
 * `{detail: [{loc, msg, type}, ...]}` for 422s. Without this the UI would
 * render "[object Object]" at exactly the moment the user needs to be told
 * what they typed wrong.
 */
function parseErrorBody(
  body: unknown,
  status: number,
): { message: string; fieldErrors?: Record<string, string> } {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return { message: detail };
  }

  if (Array.isArray(detail)) {
    const issues = detail as FastApiValidationIssue[];
    const fieldErrors: Record<string, string> = {};

    for (const issue of issues) {
      // loc looks like ["body", "mobile_number"]; the last entry is the field.
      const field = String(issue.loc?.at(-1) ?? "");
      if (field && !fieldErrors[field]) {
        fieldErrors[field] = stripPydanticPrefix(issue.msg);
      }
    }

    const first = Object.values(fieldErrors)[0];
    return {
      message: first ?? "اطلاعات ارسال‌شده معتبر نیست.",
      fieldErrors: Object.keys(fieldErrors).length ? fieldErrors : undefined,
    };
  }

  return { message: fallbackMessageForStatus(status) };
}

/** Pydantic prefixes custom errors with "Value error, ". */
function stripPydanticPrefix(message: string): string {
  return message.replace(/^Value error,\s*/i, "");
}

function fallbackMessageForStatus(status: number): string {
  if (status === 401) return "برای ادامه باید وارد حساب خود شوید.";
  if (status === 403) return "دسترسی لازم برای این عملیات را ندارید.";
  if (status === 404) return "موردی یافت نشد.";
  if (status === 409) return "این مورد از قبل ثبت شده است.";
  if (status === 429) return "تعداد درخواست‌ها زیاد است. کمی بعد تلاش کنید.";
  if (status >= 500) return "خطایی در سرور رخ داد. لطفا بعدا تلاش کنید.";
  return "درخواست با خطا مواجه شد.";
}

export interface ApiRequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Set false for public endpoints that should never send a stale token. */
  auth?: boolean;
  timeoutMs?: number;
}

/**
 * Thin `fetch` wrapper: prefixes the base URL, serialises JSON, attaches the
 * bearer token, enforces a timeout, and converts every failure into `ApiError`.
 */
export async function apiFetch<T>(
  path: string,
  { body, auth = true, timeoutMs = DEFAULT_TIMEOUT_MS, headers, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  if (auth) {
    const token = getToken();
    if (token) requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  // Without a timeout an unreachable server leaves the button spinning forever.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: init.signal ?? controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("پاسخی از سرور دریافت نشد. اتصال خود را بررسی کنید.", 0);
    }
    throw new ApiError("ارتباط با سرور برقرار نشد. اتصال خود را بررسی کنید.", 0);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  // A proxy error page or a crashed server can return HTML with a 200.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const { message, fieldErrors } = parseErrorBody(payload, response.status);
    const retryAfterHeader = response.headers.get("Retry-After");

    throw new ApiError(message, response.status, {
      fieldErrors,
      retryAfter: retryAfterHeader ? Number(retryAfterHeader) : undefined,
    });
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

/** Narrows an unknown catch binding to a user-presentable message. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "خطای پیش‌بینی‌نشده‌ای رخ داد.";
}
