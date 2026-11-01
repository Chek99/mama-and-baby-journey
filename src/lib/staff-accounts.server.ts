/**
 * Creating staff accounts and changing their access. Server-only.
 * Callers must check permissions first (see permissions.ts).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppRole } from "./permissions";
import { phoneIdentityEmail } from "./phone";
import { recordPassword } from "./passwords.server";
import { randomToken, revokeVerifiedSessions, temporaryPassword } from "./security.server";

export type CreateAccountResult =
  | { ok: true; userId: string; tempPassword?: string | undefined }
  | { ok: false; error: "taken" | "generic" };

export interface NewStaff {
  role: Exclude<AppRole, "mother" | "system_admin">;
  facilityId: string;
  fullName: string;
  email: string | null; // required for password roles
  phone: string | null; // E.164, required for CHVs
  staffId: string | null;
  licenceNumber: string | null;
  cadre: string | null;
  ward: string | null;
  createdBy: string;
}

async function identifierTaken(email: string | null, phone: string | null, staffId: string | null): Promise<boolean> {
  const checks = [];
  if (email) checks.push(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).ilike("email", email));
  if (phone) checks.push(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("phone", phone));
  if (staffId) checks.push(supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).ilike("staff_id", staffId));
  const results = await Promise.all(checks);
  return results.some((r) => (r.count ?? 0) > 0);
}

export async function createStaffAccount(input: NewStaff): Promise<CreateAccountResult> {
  const isChv = input.role === "chv";
  const loginEmail = isChv ? phoneIdentityEmail(input.phone!) : input.email!.toLowerCase();
  if (await identifierTaken(isChv ? null : loginEmail, input.phone, input.staffId)) return { ok: false, error: "taken" };

  // CHVs never use a password; they get a random one nobody knows.
  const password = isChv ? `${randomToken(24)}A1` : temporaryPassword();
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
  });
  if (error || !created.user) {
    const msg = error?.message?.toLowerCase() ?? "";
    return { ok: false, error: msg.includes("already") || msg.includes("exists") ? "taken" : "generic" };
  }
  const uid = created.user.id;
  const { error: pErr } = await supabaseAdmin.from("profiles").insert({
    id: uid,
    full_name: input.fullName,
    email: loginEmail,
    phone: input.phone,
    staff_id: input.staffId,
    facility_id: input.facilityId,
    licence_number: input.licenceNumber,
    cadre: input.cadre,
    must_change_password: !isChv,
    created_by: input.createdBy,
  });
  if (pErr) {
    await supabaseAdmin.auth.admin.deleteUser(uid);
    return { ok: false, error: pErr.code === "23505" ? "taken" : "generic" };
  }
  await supabaseAdmin.from("user_roles").insert({
    user_id: uid,
    role: input.role,
    facility_id: input.facilityId,
    ward: isChv ? input.ward : null,
    created_by: input.createdBy,
  });
  if (!isChv) await recordPassword(uid, password);
  return { ok: true, userId: uid, tempPassword: isChv ? undefined : password };
}

/** Deactivating ends access straight away; reactivating lifts the block. */
export async function setAccountActive(userId: string, active: boolean): Promise<void> {
  await supabaseAdmin.from("profiles").update({ is_active: active }).eq("id", userId);
  await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  if (!active) {
    await revokeVerifiedSessions(userId);
    await supabaseAdmin.from("trusted_devices").delete().eq("user_id", userId);
  }
}

/** Sets a one-time temporary password that must be changed at next sign-in. */
export async function issueTemporaryPasswordFor(userId: string): Promise<string | null> {
  const temp = temporaryPassword();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: temp });
  if (error) return null;
  await recordPassword(userId, temp);
  await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", userId);
  await revokeVerifiedSessions(userId);
  await supabaseAdmin.from("trusted_devices").delete().eq("user_id", userId);
  return temp;
}

export async function loadTarget(userId: string) {
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, facility_id, phone, is_active").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  if (!profile) return null;
  return {
    userId: profile.id,
    facilityId: profile.facility_id,
    phone: profile.phone,
    isActive: profile.is_active,
    roles: (roles ?? []).map((r) => r.role as AppRole),
  };
}
