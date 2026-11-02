/**
 * Browser-side session helpers. Sessions are issued by the server only after
 * full sign-in; the browser just stores them.
 */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { recordSignOut } from "./account.functions";

const DEVICE_KEY = "mnm.device";

export async function applySession(tokens: { access_token: string; refresh_token: string }) {
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw error;
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

/** Ordered sign-out: stop queries, drop cached data, end session. */
export async function signOutApp(queryClient: QueryClient) {
  try {
    await recordSignOut();
  } catch {
    /* already signed out on the server */
  }
  await queryClient.cancelQueries();
  queryClient.clear();
  await supabase.auth.signOut({ scope: "local" });
}
