/**
 * Browser-side session helpers. Sessions are issued by the backend only after
 * full sign-in; the browser just stores them.
 */
import type { QueryClient } from "@tanstack/react-query";
import { clearSession, getSession, recordSignOut, setSession, type SessionTokens } from "./api";

const DEVICE_KEY = "mnm.device";

export async function applySession(tokens: SessionTokens) {
  setSession(tokens);
}

export function hasSession(): boolean {
  return getSession() !== null;
}

export function getDeviceToken(): string | undefined {
  try {
    return window.localStorage.getItem(DEVICE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveDeviceToken(token: string | undefined) {
  if (!token) return;
  try {
    window.localStorage.setItem(DEVICE_KEY, token);
  } catch {
    /* storage unavailable */
  }
}

export const PORTAL_PATHS = ["/admin", "/facility", "/clinician", "/chv", "/mother"] as const;
export type PortalPath = (typeof PORTAL_PATHS)[number];

export function asPortal(path: string): PortalPath | "/" {
  return (PORTAL_PATHS as readonly string[]).includes(path) ? (path as PortalPath) : "/";
}

/** Ordered sign-out: tell the backend, stop queries, drop cached data, forget the session. */
export async function signOutApp(queryClient: QueryClient) {
  try {
    if (hasSession()) await recordSignOut();
  } catch {
    /* already signed out on the server */
  }
  await queryClient.cancelQueries();
  queryClient.clear();
  clearSession();
}
