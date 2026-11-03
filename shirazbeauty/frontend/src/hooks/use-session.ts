"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  AUTH_CHANGE_EVENT,
  dashboardPathForRole,
  decodeAccessToken,
  getStoredUser,
  getToken,
} from "@/lib/auth";
import type { ApiUser } from "@/types";

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onStoreChange);
  };
}

/** Must return a referentially stable value (see getStoredUser). */
function readUser(): ApiUser | null {
  return getStoredUser();
}

function readToken(): string | null {
  return getToken();
}

function readUserOnServer(): ApiUser | null {
  return null;
}

function readTokenOnServer(): string | null {
  return null;
}

export function useSession() {
  const user = useSyncExternalStore(subscribe, readUser, readUserOnServer);
  const token = useSyncExternalStore(subscribe, readToken, readTokenOnServer);

  const role = user?.role ?? (token ? decodeAccessToken(token)?.role : undefined);

  return useMemo(
    () => ({
      user,
      token,
      role,
      isAuthenticated: Boolean(token),
      dashboardHref: dashboardPathForRole(role),
    }),
    [user, token, role],
  );
}
