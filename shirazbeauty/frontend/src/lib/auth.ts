import type { ApiUser, AuthResponse, UserRole } from "@/types";

export const TOKEN_COOKIE = "sb_access_token";
export const REFRESH_COOKIE = "sb_refresh_token";
export const USER_STORAGE_KEY = "sb_user";

/** Fired on this tab after login/logout so `useSession` can re-read storage. */
export const AUTH_CHANGE_EVENT = "sb-auth-change";

/** The role selector speaks UI language; the API speaks `user_role`. */
export const UI_ROLE_TO_API = {
  client: "CLIENT",
  clinic: "CLINIC_MANAGER",
} as const satisfies Record<string, UserRole>;

function notifyAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

/**
 * Tokens live in cookies rather than localStorage so Next.js middleware can
 * read them for route protection later.
 *
 * These are NOT httpOnly — the API returns the token in its JSON body, so
 * JavaScript has to write it, which means script running on this origin can
 * read it. To actually defend against XSS the backend needs to set an httpOnly
 * cookie itself and pair it with a refresh endpoint.
 */
function setCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;

  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "path=/",
    `max-age=${maxAgeSeconds}`,
    "samesite=lax",
  ];
  if (window.location.protocol === "https:") parts.push("secure");

  document.cookie = parts.join("; ");
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function getToken(): string | null {
  return readCookie(TOKEN_COOKIE);
}

export function getRefreshToken(): string | null {
  return readCookie(REFRESH_COOKIE);
}

/** Persists the tokens and the signed-in user returned by `/auth/verify`. */
export function saveSession(auth: AuthResponse): void {
  setCookie(TOKEN_COOKIE, auth.access_token, auth.expires_in);
  // The refresh token outlives the access token; 30 days matches the API's
  // REFRESH_TOKEN_TTL_DAYS.
  setCookie(REFRESH_COOKIE, auth.refresh_token, 60 * 60 * 24 * 30);

  try {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(auth.user));
  } catch {
    // Safari private mode throws on setItem; the session still works without
    // the cached profile.
  }

  invalidateUserCache();
  notifyAuthChange();
}

let cachedUserRaw: string | null | undefined = undefined;
let cachedUser: ApiUser | null = null;

function invalidateUserCache(): void {
  cachedUserRaw = undefined;
  cachedUser = null;
}

export function getStoredUser(): ApiUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    // useSyncExternalStore compares snapshots with Object.is. JSON.parse
    // would return a new object on every read and React would re-render
    // until it hits "Maximum update depth exceeded" (minified error #185).
    if (raw === cachedUserRaw) return cachedUser;
    cachedUserRaw = raw;
    cachedUser = raw ? (JSON.parse(raw) as ApiUser) : null;
    return cachedUser;
  } catch {
    invalidateUserCache();
    return null;
  }
}

export function clearSession(): void {
  deleteCookie(TOKEN_COOKIE);
  deleteCookie(REFRESH_COOKIE);
  try {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }

  invalidateUserCache();
  notifyAuthChange();
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

/**
 * Rejects open-redirect payloads. Only same-origin relative paths are allowed.
 */
export function safeInternalPath(value: string | undefined | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.includes("://") || value.includes("\\")) return null;
  return value;
}

/** Where a user lands after signing in. */
export function dashboardPathForRole(role: UserRole | undefined): string {
  switch (role) {
    case "CLINIC_MANAGER":
    case "ADMIN":
      return "/dashboard/clinic";
    case "CLIENT":
      return "/dashboard/client";
    default:
      // An unrecognised role means the API added one the UI does not know
      // about yet. The client panel is the safe, least-privileged landing spot.
      return "/dashboard/client";
  }
}

/** Prefer a safe `next` return URL after OTP, otherwise the role dashboard. */
export function postLoginPath(
  role: UserRole | undefined,
  next: string | null | undefined,
): string {
  const fallback = dashboardPathForRole(role);
  const safe = safeInternalPath(next);
  if (!safe) return fallback;
  if (role === "CLINIC_MANAGER" || role === "ADMIN") {
    return safe.startsWith("/dashboard/clinic") ? safe : fallback;
  }
  return safe.startsWith("/dashboard/client") ? safe : fallback;
}

interface JwtPayload {
  sub?: string;
  role?: UserRole;
  type?: string;
  exp?: number;
}

/**
 * Reads the JWT payload without verifying the signature. Verification is the
 * API's job; this is only used to pick a dashboard when the stored user is
 * missing but a token is still present.
 */
export function decodeAccessToken(token: string): JwtPayload | null {
  try {
    const segment = token.split(".")[1];
    if (!segment) return null;

    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(padded);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}
