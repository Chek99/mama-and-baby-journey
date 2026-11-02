import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "./account.functions";
import type { AppRole } from "./permissions";

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe(),
  staleTime: 60_000,
});

/**
 * Loads the signed-in user for a portal and sends them elsewhere when the
 * session is not fully verified, a temporary password must be replaced, or
 * the portal is not theirs. The server re-checks every action regardless.
 */
export async function requirePortal(queryClient: QueryClient, allowed: AppRole[] | "any") {
  const me = await queryClient.ensureQueryData(meQueryOptions);
  if (!me.verified) {
    queryClient.clear();
    await supabase.auth.signOut({ scope: "local" });
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
