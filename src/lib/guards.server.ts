/**
 * Server-side access checks for signed-in server actions. The bearer token is
 * already validated by requireSupabaseAuth; these helpers also require that
 * the session completed full sign-in and load the caller's roles.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Actor, AppRole } from "./permissions";

export interface AuthedContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims: Record<string, unknown> & { session_id?: string };
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have access to this.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function loadActor(ctx: AuthedContext): Promise<Actor & { verified: boolean }> {
  const [{ data: verified }, { data: roles }, { data: profile }] = await Promise.all([
    ctx.supabase.rpc("is_session_verified"),
    ctx.supabase.from("user_roles").select("role").eq("user_id", ctx.userId),
    ctx.supabase.from("profiles").select("facility_id").eq("id", ctx.userId).maybeSingle(),
  ]);
  return {
    userId: ctx.userId,
    verified: verified === true,
    roles: (roles ?? []).map((r) => r.role as AppRole),
    facilityId: profile?.facility_id ?? null,
  };
}

export async function requireVerified(ctx: AuthedContext): Promise<Actor> {
  const actor = await loadActor(ctx);
  if (!actor.verified) throw new ForbiddenError("Please sign in again.");
  return actor;
}

export async function requireRole(ctx: AuthedContext, ...roles: AppRole[]): Promise<Actor> {
  const actor = await requireVerified(ctx);
  if (!roles.some((r) => actor.roles.includes(r))) throw new ForbiddenError();
  return actor;
}

export function primaryRole(roles: AppRole[]): AppRole | null {
  const order: AppRole[] = ["system_admin", "hospital_admin", "clinician", "chv", "mother"];
  return order.find((r) => roles.includes(r)) ?? null;
}
