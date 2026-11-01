/**
 * Signed-in account actions: who am I, change password, backup codes,
 * sign out everywhere, language.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuthedContext } from "./guards.server";
import type { PublicAuthError } from "./auth-rules";
import { isPasswordAcceptable } from "./password-rules";
import { STAFF_PASSWORD_ROLES, portalPathFor, type AppRole } from "./permissions";

export interface MeDto {
  verified: boolean;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  staffId: string | null;
  language: "en" | "sw";
  roles: AppRole[];
  portal: string;
  mustChangePassword: boolean;
  usesPassword: boolean;
  facility: { id: string; name: string; isActive: boolean } | null;
  idleMinutes: number;
}

function bearer(): Promise<string> {
  return import("@tanstack/react-start/server").then(({ getRequest }) =>
    getRequest()!.headers.get("authorization")!.replace("Bearer ", ""),
  );
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeDto> => {
    const { loadActor } = await import("./guards.server");
    const ctx = context as unknown as AuthedContext;
    const actor = await loadActor(ctx);
    const { data: profile } = await ctx.supabase
      .from("profiles")
      .select("full_name, email, phone, staff_id, language, must_change_password")
      .eq("id", ctx.userId)
      .maybeSingle();
    let facility: MeDto["facility"] = null;
    let idleMinutes = 15;
    if (actor.verified) {
      if (actor.facilityId) {
        const { data: f } = await ctx.supabase.from("facilities").select("id, name, is_active").eq("id", actor.facilityId).maybeSingle();
        if (f) facility = { id: f.id, name: f.name, isActive: f.is_active };
      }
      const usesPassword = actor.roles.some((r) => STAFF_PASSWORD_ROLES.includes(r));
      const { data: setting } = await ctx.supabase
        .from("app_settings")
        .select("value")
        .eq("key", usesPassword ? "staff_idle_timeout_minutes" : "mother_idle_timeout_minutes")
        .maybeSingle();
      const n = Number(setting?.value);
      if (Number.isFinite(n) && n > 0) idleMinutes = n;
      else idleMinutes = usesPassword ? 15 : 30;
    }
    const usesPassword = actor.roles.some((r) => STAFF_PASSWORD_ROLES.includes(r));
    // Internal phone sign-in identities are never shown.
    const email = profile?.email && !profile.email.endsWith(".invalid") ? profile.email : null;
    return {
      verified: actor.verified,
      userId: ctx.userId,
      fullName: profile?.full_name ?? "",
      email,
      phone: profile?.phone ?? null,
      staffId: profile?.staff_id ?? null,
      language: profile?.language === "sw" ? "sw" : "en",
      roles: actor.roles,
      portal: portalPathFor(actor.roles),
      mustChangePassword: !!profile?.must_change_password && usesPassword,
      usesPassword,
      facility,
      idleMinutes,
    };
  });

const changeSchema = z.object({
  currentPassword: z.string().max(200).optional(),
  newPassword: z.string().min(1).max(200),
});

export const changePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changeSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: PublicAuthError }> => {
    const { requireVerified } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const pw = await import("./passwords.server");
    const sms = await import("./sms.server");
    const { passwordChangedSms } = await import("./sms-templates");
    const ctx = context as unknown as AuthedContext;
    const actor = await requireVerified(ctx);
    if (!actor.roles.some((r) => STAFF_PASSWORD_ROLES.includes(r))) return { ok: false, error: "generic" };
    if (await sec.rateLimited(`pwchange:${ctx.userId}`, 5)) return { ok: false, error: "locked" };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("email, phone, language, facility_id, must_change_password")
      .eq("id", ctx.userId)
      .single();
    if (!profile?.email) return { ok: false, error: "generic" };

    // The current password is needed unless the user is replacing a temporary one.
    if (!profile.must_change_password) {
      if (!data.currentPassword) return { ok: false, error: "generic" };
      const anon = sec.publicAuthClient();
      const { data: check, error } = await anon.auth.signInWithPassword({ email: profile.email, password: data.currentPassword });
      if (error || !check.session) {
        await sec.audit({ action: "auth.password_change_failed", actorUserId: ctx.userId, facilityId: profile.facility_id, success: false });
        return { ok: false, error: "generic" };
      }
      await supabaseAdmin.auth.admin.signOut(check.session.access_token, "local");
    }

    if (!isPasswordAcceptable(data.newPassword, { email: profile.email })) return { ok: false, error: "weak_password" };
    if (await pw.isReusedPassword(ctx.userId, data.newPassword)) return { ok: false, error: "reused_password" };
    if (!(await pw.setUserPassword(ctx.userId, data.newPassword))) return { ok: false, error: "weak_password" };

    const token = await bearer();
    const sessionId = sec.decodeJwtPayload(token)["session_id"];
    await sec.revokeVerifiedSessions(ctx.userId, typeof sessionId === "string" ? sessionId : undefined);
    await supabaseAdmin.auth.admin.signOut(token, "others");
    await supabaseAdmin.from("trusted_devices").delete().eq("user_id", ctx.userId);
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", ctx.userId);
    if (profile.phone) {
      await sms.sendSms({
        to: profile.phone,
        message: passwordChangedSms(profile.language === "sw" ? "sw" : "en"),
        purpose: "password_changed",
        facilityId: profile.facility_id,
      });
    }
    await sec.audit({
      action: profile.must_change_password ? "auth.temporary_password_replaced" : "auth.password_changed",
      actorUserId: ctx.userId,
      actorRole: actor.roles[0] ?? null,
      facilityId: profile.facility_id,
      entityType: "user",
      entityId: ctx.userId,
    });
    return { ok: true };
  });

export const signOutEverywhere = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const ctx = context as unknown as AuthedContext;
    await sec.revokeVerifiedSessions(ctx.userId);
    await supabaseAdmin.from("trusted_devices").delete().eq("user_id", ctx.userId);
    await supabaseAdmin.auth.admin.signOut(await bearer(), "global");
    await sec.audit({ action: "auth.signed_out_everywhere", actorUserId: ctx.userId });
    return { ok: true };
  });

/** Ends this session's app access when the user signs out. */
export const recordSignOut = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const ctx = context as unknown as AuthedContext;
    const sessionId = sec.decodeJwtPayload(await bearer())["session_id"];
    if (typeof sessionId === "string") {
      await supabaseAdmin
        .from("verified_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("session_id", sessionId)
        .eq("user_id", ctx.userId);
    }
    await sec.audit({ action: "auth.signed_out", actorUserId: ctx.userId });
    return { ok: true };
  });

export const backupCodeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ remaining: number }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ctx = context as unknown as AuthedContext;
    await requireRole(ctx, ...STAFF_PASSWORD_ROLES);
    const { count } = await supabaseAdmin
      .from("backup_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.userId)
      .is("used_at", null);
    return { remaining: count ?? 0 };
  });

export const generateBackupCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ codes: string[] }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const ctx = context as unknown as AuthedContext;
    const actor = await requireRole(ctx, ...STAFF_PASSWORD_ROLES);
    const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const buf = new Uint32Array(10);
      crypto.getRandomValues(buf);
      const raw = Array.from(buf, (b) => alphabet[b % alphabet.length]).join("");
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    await supabaseAdmin.from("backup_codes").delete().eq("user_id", ctx.userId);
    const rows = await Promise.all(
      codes.map(async (c) => ({ user_id: ctx.userId, code_hash: await sec.keyedHash(`backup:${ctx.userId}:${c.replace("-", "")}`) })),
    );
    await supabaseAdmin.from("backup_codes").insert(rows);
    await sec.audit({ action: "auth.backup_codes_generated", actorUserId: ctx.userId, facilityId: actor.facilityId });
    return { codes };
  });

export const setMyLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ language: z.enum(["en", "sw"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ language: data.language }).eq("id", (context as unknown as AuthedContext).userId);
    return { ok: true };
  });
