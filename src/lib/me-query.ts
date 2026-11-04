import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { ApiError, clearSession, getMe, getSession } from "./api";
import type { AppRole } from "./permissions";

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe(),
  staleTime: 60_000,
});

/**
 * Loads the signed-in user for a portal and sends them elsewhere when there is
 * no session, it is not fully verified, a temporary password must be replaced,
 * or the portal is not theirs. The backend must re-check every action regardless.
 */
export async function requirePortal(queryClient: QueryClient, allowed: AppRole[] | "any") {
  if (!getSession()) throw redirect({ to: "/auth" });
  let me;
  try {
    me = await queryClient.ensureQueryData(meQueryOptions);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403 || e.code === "not_configured")) {
      queryClient.clear();
      clearSession();
      throw redirect({ to: "/auth" });
    }
    throw e;
  }
  if (!me.verified) {
    queryClient.clear();
    clearSession();
    throw redirect({ to: "/auth" });
  }
  if (me.mustChangePassword) throw redirect({ to: "/change-password" });
  if (allowed !== "any" && !allowed.some((r) => me.roles.includes(r))) {
    const p = me.portal;
    if (p === "/admin") throw redirect({ to: "/admin" });
    if (p === "/facility") throw redirect({ to: "/facility" });
    if (p === "/clinician") throw redirect({ to: "/clinician" });
    if (p === "/chv") throw redirect({ to: "/chv" });
    if (p === "/mother") throw redirect({ to: "/mother" });
    throw redirect({ to: "/" });
  }
  return me;
}
