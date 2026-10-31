/**
 * Public sign-in server actions (no session required).
 * Every action is rate-limited and never reveals whether an account exists.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_CODE_ATTEMPTS,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  RESET_LINK_TTL_MS,
  TRUSTED_DEVICE_DAYS,
  isExpired,
  toPublicAuthError,
  type InternalAuthFailure,
  type PublicAuthError,
} from "./auth-rules";
import { isPasswordAcceptable } from "./password-rules";
import { STAFF_PASSWORD_ROLES, portalPathFor, type AppRole } from "./permissions";
import { normalizeKenyanPhone } from "./phone";

type Fail = { ok: false; error: PublicAuthError };
type SessionTokens = { access_token: string; refresh_token: string };

const fail = (reason: InternalAuthFailure): Fail => ({ ok: false, error: toPublicAuthError(reason) });

// ---------------------------------------------------------------------------
// First-run setup
// ---------------------------------------------------------------------------
export const getSetupStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("id", { count: "exact", head: true })
    .eq("role", "system_admin");
  return { needsSetup: (count ?? 0) === 0 };
});

const bootstrapSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
});

export const bootstrapSystemAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => bootstrapSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: "closed" | "weak_password" | "locked" | "generic" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit, rateLimited, requestMeta } = await import("./security.server");
    const { recordPassword } = await import("./passwords.server");
    const meta = requestMeta();
    if (await rateLimited(`setup:ip:${meta.ip}`, 10)) return { ok: false, error: "locked" };
    if (!isPasswordAcceptable(data.password, { email: data.email })) return { ok: false, error: "weak_password" };

    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "system_admin");
    if ((count ?? 0) > 0) return { ok: false, error: "closed" };

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      // HIBP (leaked password) rejections surface here.
      return { ok: false, error: error?.message?.toLowerCase().includes("password") ? "weak_password" : "generic" };
    }
    const uid = created.user.id;
    await supabaseAdmin.from("profiles").insert({ id: uid, full_name: data.fullName, email: data.email });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "system_admin" });

    // Guard against two people completing setup at the same moment.
    const { count: after } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "system_admin");
    if ((after ?? 0) > 1) {
      await supabaseAdmin.auth.admin.deleteUser(uid);
      return { ok: false, error: "closed" };
    }
    await recordPassword(uid, data.password);
    await audit({ action: "setup.system_admin_created", actorUserId: uid, actorRole: "system_admin", entityType: "user", entityId: uid });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Health worker sign-in: password, then 6-digit email code
// ---------------------------------------------------------------------------
async function resolveStaffByIdentifier(identifier: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const id = identifier.trim();
  const query = supabaseAdmin.from("profiles").select("id, email, facility_id, is_active, must_change_password");
  const { data: profile } = id.includes("@")
    ? await query.ilike("email", id).maybeSingle()
    : await query.ilike("staff_id", id).maybeSingle();
  if (!profile || !profile.email) return null;
  const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id);
  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  return { ...profile, email: profile.email, roles: roleList };
}

async function facilityIsActive(facilityId: string | null): Promise<boolean> {
  if (!facilityId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("facilities").select("is_active").eq("id", facilityId).maybeSingle();
  return !!data?.is_active;
}

const staffStartSchema = z.object({
  identifier: z.string().trim().min(2).max(200),
  password: z.string().min(1).max(200),
  rememberDevice: z.boolean().default(false),
  deviceToken: z.string().max(200).optional(),
});

export const staffLoginStart = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => staffStartSchema.parse(d))
  .handler(
    async ({
      data,
    }): Promise<
      | Fail
      | { ok: true; step: "code"; challengeId: string; maskedEmail: string }
      | { ok: true; step: "done"; session: SessionTokens; portal: string; mustChangePassword: boolean }
    > => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sec = await import("./security.server");
      const meta = sec.requestMeta();
      const acctKey = await sec.keyedHash(`acct:${data.identifier.toLowerCase()}`);
      if ((await sec.rateLimited(`login:ip:${meta.ip}`, 30)) || (await sec.rateLimited(`login:acct:${acctKey}`, 5))) {
        await sec.audit({ action: "auth.login_locked", success: false });
        return fail("locked");
      }

      const staff = await resolveStaffByIdentifier(data.identifier);
      const failAudit = async (reason: InternalAuthFailure, userId?: string) => {
        await sec.audit({ action: "auth.login_failed", actorUserId: userId ?? null, success: false, metadata: { reason } });
        return fail(reason);
      };
      if (!staff) return failAudit("no_account");
      if (!staff.roles.some((r) => STAFF_PASSWORD_ROLES.includes(r))) return failAudit("wrong_portal", staff.id);

      // Check the password with a throwaway session, then revoke it at once:
      // a password alone never gives access.
      const anon = sec.publicAuthClient();
      const { data: pw, error: pwErr } = await anon.auth.signInWithPassword({ email: staff.email, password: data.password });
      if (pwErr || !pw.session) return failAudit("bad_password", staff.id);
      await supabaseAdmin.auth.admin.signOut(pw.session.access_token, "local");

      if (!staff.is_active) return failAudit("inactive_account", staff.id);
      if (!staff.roles.includes("system_admin") && !(await facilityIsActive(staff.facility_id))) {
        return failAudit("inactive_facility", staff.id);
      }

      // Trusted device: skip the email code.
      if (data.deviceToken) {
        const tokenHash = await sec.keyedHash(`device:${data.deviceToken}`);
        const { data: dev } = await supabaseAdmin
          .from("trusted_devices")
          .select("id, expires_at")
          .eq("user_id", staff.id)
          .eq("token_hash", tokenHash)
          .maybeSingle();
        if (dev && new Date(dev.expires_at).getTime() > Date.now()) {
          const session = await sec.mintSession(staff.email);
          await sec.markSessionVerified(session.access_token, staff.id, "password_trusted_device");
          await supabaseAdmin.from("trusted_devices").update({ last_used_at: new Date().toISOString() }).eq("id", dev.id);
          await sec.audit({ action: "auth.login_success", actorUserId: staff.id, facilityId: staff.facility_id, metadata: { method: "trusted_device" } });
          return {
            ok: true,
            step: "done",
            session: sec.sessionDto(session),
            portal: portalPathFor(staff.roles),
            mustChangePassword: staff.must_change_password,
          };
        }
      }

      const { data: challenge, error: chErr } = await supabaseAdmin
        .from("login_challenges")
        .insert({
          user_id: staff.id,
          expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
          remember_device: data.rememberDevice,
          ip: meta.ip,
        })
        .select("id")
        .single();
      if (chErr || !challenge) return fail("bad_code");

      const { error: otpErr } = await anon.auth.signInWithOtp({
        email: staff.email,
        options: { shouldCreateUser: false, emailRedirectTo: `${meta.origin}/verify-sign-in?c=${challenge.id}` },
      });
      if (otpErr) console.error("email code send failed", otpErr.message);
      await sec.audit({ action: "auth.password_ok_code_sent", actorUserId: staff.id, facilityId: staff.facility_id });

      const [local, domain] = staff.email.split("@");
      const maskedEmail = `${local!.slice(0, 2)}•••@${domain}`;
      return { ok: true, step: "code", challengeId: challenge.id, maskedEmail };
    },
  );

async function loadOpenChallenge(challengeId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("login_challenges")
    .select("id, user_id, expires_at, attempts, used_at, remember_device, last_sent_at, resend_count")
    .eq("id", challengeId)
    .maybeSingle();
  if (!data || data.used_at) return { error: "bad_code" as const };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { error: "expired" as const };
  if (data.attempts >= MAX_CODE_ATTEMPTS) return { error: "too_many_attempts" as const };
  return { challenge: data };
}

async function finishStaffSignIn(userId: string, sessionAccess: string, challengeId: string, rememberDevice: boolean, method: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const sec = await import("./security.server");
  await supabaseAdmin.from("login_challenges").update({ used_at: new Date().toISOString() }).eq("id", challengeId);
  await sec.markSessionVerified(sessionAccess, userId, method);
  let deviceToken: string | undefined;
  if (rememberDevice) {
    deviceToken = sec.randomToken(32);
    await supabaseAdmin.from("trusted_devices").insert({
      user_id: userId,
      token_hash: await sec.keyedHash(`device:${deviceToken}`),
      device: sec.requestMeta().device,
      expires_at: new Date(Date.now() + TRUSTED_DEVICE_DAYS * 86400 * 1000).toISOString(),
    });
  }
  const [{ data: profile }, { data: roles }] = await Promise.all([
    supabaseAdmin.from("profiles").select("facility_id, must_change_password").eq("id", userId).single(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
  ]);
  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  await sec.audit({ action: "auth.login_success", actorUserId: userId, actorRole: roleList[0] ?? null, facilityId: profile?.facility_id ?? null, metadata: { method } });
  return { deviceToken, portal: portalPathFor(roleList), mustChangePassword: !!profile?.must_change_password };
}

const verifyCodeSchema = z.object({ challengeId: z.string().uuid(), code: z.string().regex(/^\d{6,8}$/) });

export const staffLoginVerifyCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifyCodeSchema.parse(d))
  .handler(
    async ({ data }): Promise<Fail | { ok: true; session: SessionTokens; portal: string; mustChangePassword: boolean; deviceToken?: string | undefined }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sec = await import("./security.server");
      if (await sec.rateLimited(`2fa:ip:${sec.requestMeta().ip}`, 40)) return fail("locked");
      const res = await loadOpenChallenge(data.challengeId);
      if ("error" in res) return fail(res.error!);
      const ch = res.challenge;
      await supabaseAdmin.from("login_challenges").update({ attempts: ch.attempts + 1 }).eq("id", ch.id);

      const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", ch.user_id).single();
      if (!profile?.email) return fail("bad_code");
      const anon = sec.publicAuthClient();
      const { data: v, error } = await anon.auth.verifyOtp({ email: profile.email, token: data.code, type: "email" });
      if (error || !v.session) {
        await sec.audit({ action: "auth.code_failed", actorUserId: ch.user_id, success: false });
        return fail("bad_code");
      }
      const done = await finishStaffSignIn(ch.user_id, v.session.access_token, ch.id, ch.remember_device, "password_email_code");
      return { ok: true, session: sec.sessionDto(v.session), ...done };
    },
  );

const backupSchema = z.object({ challengeId: z.string().uuid(), backupCode: z.string().trim().min(6).max(20) });

export const staffLoginUseBackupCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => backupSchema.parse(d))
  .handler(
    async ({ data }): Promise<Fail | { ok: true; session: SessionTokens; portal: string; mustChangePassword: boolean; deviceToken?: string | undefined }> => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const sec = await import("./security.server");
      if (await sec.rateLimited(`2fa:ip:${sec.requestMeta().ip}`, 40)) return fail("locked");
      const res = await loadOpenChallenge(data.challengeId);
      if ("error" in res) return fail(res.error!);
      const ch = res.challenge;
      await supabaseAdmin.from("login_challenges").update({ attempts: ch.attempts + 1 }).eq("id", ch.id);

      const normalized = data.backupCode.replace(/[^a-z0-9]/gi, "").toLowerCase();
      const codeHash = await sec.keyedHash(`backup:${ch.user_id}:${normalized}`);
      const { data: row } = await supabaseAdmin
        .from("backup_codes")
        .select("id")
        .eq("user_id", ch.user_id)
        .eq("code_hash", codeHash)
        .is("used_at", null)
        .maybeSingle();
      if (!row) {
        await sec.audit({ action: "auth.backup_code_failed", actorUserId: ch.user_id, success: false });
        return fail("bad_code");
      }
      await supabaseAdmin.from("backup_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
      const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", ch.user_id).single();
      const session = await sec.mintSession(profile!.email!);
      const done = await finishStaffSignIn(ch.user_id, session.access_token, ch.id, ch.remember_device, "password_backup_code");
      return { ok: true, session: sec.sessionDto(session), ...done };
    },
  );

export const resendStaffCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<Fail | { ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const res = await loadOpenChallenge(data.challengeId);
    if ("error" in res) return fail(res.error!);
    const ch = res.challenge;
    if (Date.now() - new Date(ch.last_sent_at).getTime() < RESEND_COOLDOWN_MS || ch.resend_count >= 4) return fail("locked");
    const { data: profile } = await supabaseAdmin.from("profiles").select("email").eq("id", ch.user_id).single();
    if (!profile?.email) return fail("bad_code");
    const meta = sec.requestMeta();
    await sec.publicAuthClient().auth.signInWithOtp({
      email: profile.email,
      options: { shouldCreateUser: false, emailRedirectTo: `${meta.origin}/verify-sign-in?c=${ch.id}` },
    });
    await supabaseAdmin
      .from("login_challenges")
      .update({
        last_sent_at: new Date().toISOString(),
        resend_count: ch.resend_count + 1,
        // A resend gives a fresh 5 minutes.
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })
      .eq("id", ch.id);
    await sec.audit({ action: "auth.code_resent", actorUserId: ch.user_id });
    return { ok: true };
  });

/**
 * Second factor completed by tapping the link in the sign-in email instead of
 * typing the code. The link created a session; it only becomes usable once it
 * matches an open challenge that already passed the password step.
 */
export const confirmEmailLinkSignIn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ challengeId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<Fail | { ok: true; portal: string; mustChangePassword: boolean; deviceToken?: string | undefined }> => {
    const sec = await import("./security.server");
    const res = await loadOpenChallenge(data.challengeId);
    if ("error" in res) return fail(res.error!);
    if (res.challenge.user_id !== context.userId) return fail("bad_code");
    const { getRequest } = await import("@tanstack/react-start/server");
    const token = getRequest()!.headers.get("authorization")!.replace("Bearer ", "");
    const done = await finishStaffSignIn(context.userId, token, res.challenge.id, res.challenge.remember_device, "password_email_link");
    void sec;
    return { ok: true, ...done };
  });

// ---------------------------------------------------------------------------
// Mothers, guardians and CHVs: phone number + SMS code
// ---------------------------------------------------------------------------
const phoneSchema = z.object({
  phone: z.string().trim().min(9).max(20),
  purpose: z.enum(["sign_in", "activate"]).default("sign_in"),
  language: z.enum(["en", "sw"]).default("en"),
});

export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => phoneSchema.parse(d))
  .handler(async ({ data }): Promise<Fail | { ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const sms = await import("./sms.server");
    const { otpSms } = await import("./sms-templates");
    if (!sms.getSmsProvider()) return fail("sms_unavailable");
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) return fail("bad_code");
    const meta = sec.requestMeta();
    const phoneHash = await sec.keyedHash(`phone:${phone}`);
    if ((await sec.rateLimited(`otp:ip:${meta.ip}`, 20)) || (await sec.rateLimited(`otp:phone:${phoneHash}`, 4))) {
      await sec.audit({ action: "auth.otp_locked", success: false });
      return fail("locked");
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, is_active, language, facility_id")
      .eq("phone", phone)
      .maybeSingle();
    let eligible = false;
    if (profile?.is_active) {
      const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id);
      eligible = (roles ?? []).some((r) => r.role === "mother" || r.role === "chv");
    }
    // Same answer whether or not the number is registered.
    if (!eligible || !profile) {
      await sec.audit({ action: "auth.otp_requested_unknown", success: false });
      return { ok: true };
    }

    const { data: last } = await supabaseAdmin
      .from("sms_otps")
      .select("last_sent_at")
      .eq("phone_hash", phoneHash)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last && Date.now() - new Date(last.last_sent_at).getTime() < RESEND_COOLDOWN_MS) return { ok: true };

    const code = sec.randomDigits(6);
    const { data: otp } = await supabaseAdmin
      .from("sms_otps")
      .insert({
        phone_hash: phoneHash,
        code_hash: "pending",
        purpose: data.purpose,
        expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
      })
      .select("id")
      .single();
    if (!otp) return { ok: true };
    await supabaseAdmin.from("sms_otps").update({ code_hash: await sec.keyedHash(`otp:${otp.id}:${code}`) }).eq("id", otp.id);
    const lang = (profile.language === "sw" ? "sw" : data.language) as "en" | "sw";
    await sms.sendSms({ to: phone, message: otpSms(code, lang), purpose: `otp_${data.purpose}`, facilityId: profile.facility_id });
    await sec.audit({ action: "auth.otp_sent", actorUserId: profile.id, metadata: { purpose: data.purpose } });
    return { ok: true };
  });

const phoneVerifySchema = z.object({ phone: z.string().trim().min(9).max(20), code: z.string().regex(/^\d{6}$/) });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => phoneVerifySchema.parse(d))
  .handler(async ({ data }): Promise<Fail | { ok: true; session: SessionTokens; portal: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const phone = normalizeKenyanPhone(data.phone);
    if (!phone) return fail("bad_code");
    const meta = sec.requestMeta();
    const phoneHash = await sec.keyedHash(`phone:${phone}`);
    if (await sec.rateLimited(`otpv:ip:${meta.ip}`, 40)) return fail("locked");

    const { data: otp } = await supabaseAdmin
      .from("sms_otps")
      .select("id, code_hash, attempts, created_at, expires_at")
      .eq("phone_hash", phoneHash)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!otp) return fail("bad_code");
    if (isExpired(otp.created_at, OTP_TTL_MS) || new Date(otp.expires_at).getTime() <= Date.now()) return fail("expired");
    if (otp.attempts >= MAX_CODE_ATTEMPTS) return fail("too_many_attempts");
    await supabaseAdmin.from("sms_otps").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);

    const expected = await sec.keyedHash(`otp:${otp.id}:${data.code}`);
    if (!sec.constantTimeEqual(expected, otp.code_hash)) {
      await sec.audit({ action: "auth.otp_failed", success: false });
      return fail("bad_code");
    }
    await supabaseAdmin.from("sms_otps").update({ used_at: new Date().toISOString() }).eq("id", otp.id);

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, is_active, activated_at, facility_id")
      .eq("phone", phone)
      .maybeSingle();
    if (!profile?.is_active || !profile.email) return fail("bad_code");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", profile.id);
    const roleList = (roles ?? []).map((r) => r.role as AppRole);

    const session = await sec.mintSession(profile.email);
    await sec.markSessionVerified(session.access_token, profile.id, "phone_sms_code");
    if (!profile.activated_at) {
      await supabaseAdmin.from("profiles").update({ activated_at: new Date().toISOString() }).eq("id", profile.id);
    }
    await sec.audit({ action: "auth.login_success", actorUserId: profile.id, actorRole: roleList[0] ?? null, facilityId: profile.facility_id, metadata: { method: "sms_code" } });
    return { ok: true, session: sec.sessionDto(session), portal: portalPathFor(roleList) };
  });

// ---------------------------------------------------------------------------
// Password reset (health workers)
// ---------------------------------------------------------------------------
export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ identifier: z.string().trim().min(2).max(200) }).parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | Fail> => {
    const sec = await import("./security.server");
    const meta = sec.requestMeta();
    const acctKey = await sec.keyedHash(`acct:${data.identifier.toLowerCase()}`);
    if ((await sec.rateLimited(`reset:ip:${meta.ip}`, 10)) || (await sec.rateLimited(`reset:acct:${acctKey}`, 3))) {
      return fail("locked");
    }
    const staff = await resolveStaffByIdentifier(data.identifier);
    if (staff && staff.is_active && staff.roles.some((r) => STAFF_PASSWORD_ROLES.includes(r))) {
      const { error } = await sec.publicAuthClient().auth.resetPasswordForEmail(staff.email, {
        redirectTo: `${meta.origin}/reset-password`,
      });
      if (error) console.error("reset email failed", error.message);
      await sec.audit({ action: "auth.password_reset_requested", actorUserId: staff.id, facilityId: staff.facility_id });
    } else {
      await sec.audit({ action: "auth.password_reset_requested_unknown", success: false });
    }
    return { ok: true };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | Fail> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const pw = await import("./passwords.server");
    const sms = await import("./sms.server");
    const { passwordChangedSms } = await import("./sms-templates");

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const user = u?.user;
    const amr = (context.claims["amr"] as { method?: string }[] | undefined) ?? [];
    const fromRecovery = amr.some((m) => m.method === "recovery" || m.method === "otp");
    const sentAt = user?.recovery_sent_at ? new Date(user.recovery_sent_at).getTime() : 0;
    if (!user || !fromRecovery || !sentAt || Date.now() - sentAt > RESET_LINK_TTL_MS) return fail("expired");
    if (!isPasswordAcceptable(data.password, { email: user.email ?? null })) return { ok: false, error: "weak_password" };
    if (await pw.isReusedPassword(user.id, data.password)) return { ok: false, error: "reused_password" };
    if (!(await pw.setUserPassword(user.id, data.password))) return { ok: false, error: "weak_password" };

    // End every session and refresh token for this account.
    await sec.revokeVerifiedSessions(user.id);
    const { getRequest } = await import("@tanstack/react-start/server");
    const token = getRequest()!.headers.get("authorization")!.replace("Bearer ", "");
    await supabaseAdmin.auth.admin.signOut(token, "global");
    await supabaseAdmin.from("trusted_devices").delete().eq("user_id", user.id);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", user.id)
      .select("phone, language, facility_id")
      .single();
    if (profile?.phone) {
      await sms.sendSms({ to: profile.phone, message: passwordChangedSms(profile.language === "sw" ? "sw" : "en"), purpose: "password_changed", facilityId: profile.facility_id });
    }
    await sec.audit({ action: "auth.password_reset_completed", actorUserId: user.id, facilityId: profile?.facility_id ?? null });
    return { ok: true };
  });
