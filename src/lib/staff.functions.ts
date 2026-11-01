/**
 * Staff management. Hospital admins manage their own facility; the system
 * admin manages hospital admins. Rules live in permissions.ts and are
 * re-checked here on every call.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AuthedContext } from "./guards.server";
import { assignableRoles, canManageStaffMember, type AppRole } from "./permissions";
import { normalizeKenyanPhone } from "./phone";

export interface StaffDto {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  staffId: string | null;
  licenceNumber: string | null;
  cadre: string | null;
  role: AppRole;
  ward: string | null;
  facilityId: string | null;
  facilityName: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

const ctxOf = (c: unknown) => c as AuthedContext;
const STAFF_ROLES: AppRole[] = ["hospital_admin", "clinician", "chv"];

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ scope: z.enum(["facility", "hospital_admins"]) }).parse(d))
  .handler(async ({ data, context }): Promise<StaffDto[]> => {
    const { requireRole, ForbiddenError } = await import("./guards.server");
    const ctx = ctxOf(context);
    const actor = await requireRole(ctx, "system_admin", "hospital_admin");
    let rq = ctx.supabase.from("user_roles").select("user_id, role, ward, facility_id");
    if (data.scope === "hospital_admins") {
      if (!actor.roles.includes("system_admin")) throw new ForbiddenError();
      rq = rq.eq("role", "hospital_admin");
    } else {
      if (!actor.roles.includes("hospital_admin") || !actor.facilityId) throw new ForbiddenError();
      rq = rq.in("role", STAFF_ROLES).eq("facility_id", actor.facilityId);
    }
    const { data: roles } = await rq;
    const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
    if (!ids.length) return [];
    const { data: people } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, email, phone, staff_id, licence_number, cadre, facility_id, is_active, must_change_password, created_at")
      .in("id", ids);
    const facilityIds = [...new Set((people ?? []).map((p) => p.facility_id).filter((v): v is string => !!v))];
    const { data: facilities } = facilityIds.length
      ? await ctx.supabase.from("facilities").select("id, name").in("id", facilityIds)
      : { data: [] as { id: string; name: string }[] };
    const facOf = new Map((facilities ?? []).map((f) => [f.id, f.name]));
    const roleOf = new Map<string, { role: AppRole; ward: string | null }>();
    const rank = (r: AppRole) => STAFF_ROLES.indexOf(r);
    for (const r of roles ?? []) {
      const cur = roleOf.get(r.user_id);
      const role = r.role as AppRole;
      if (!cur || rank(role) < rank(cur.role)) roleOf.set(r.user_id, { role, ward: r.ward });
    }
    return (people ?? [])
      .map((p) => ({
        userId: p.id,
        fullName: p.full_name,
        email: p.email && !p.email.endsWith(".invalid") ? p.email : null,
        phone: p.phone,
        staffId: p.staff_id,
        licenceNumber: p.licence_number,
        cadre: p.cadre,
        role: roleOf.get(p.id)?.role ?? "clinician",
        ward: roleOf.get(p.id)?.ward ?? null,
        facilityId: p.facility_id,
        facilityName: p.facility_id ? (facOf.get(p.facility_id) ?? null) : null,
        isActive: p.is_active,
        mustChangePassword: p.must_change_password,
        createdAt: p.created_at,
      }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  });

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const addSchema = z
  .object({
    role: z.enum(["hospital_admin", "clinician", "chv"]),
    facilityId: z.string().uuid().optional(),
    fullName: z.string().trim().min(2).max(120),
    email: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((v) => (v ? v.toLowerCase() : null)),
    phone: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v ? normalizeKenyanPhone(v) ?? "invalid" : null)),
    staffId: optText(40),
    licenceNumber: optText(60),
    cadre: optText(60),
    ward: optText(80),
  })
  .superRefine((v, ctx) => {
    if (v.phone === "invalid") ctx.addIssue({ code: "custom", path: ["phone"], message: "phone" });
    if (v.role === "chv" && !v.phone) ctx.addIssue({ code: "custom", path: ["phone"], message: "required" });
    if (v.role !== "chv" && (!v.email || !z.string().email().safeParse(v.email).success)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "email" });
    }
  });

export const addStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; tempPassword?: string | undefined } | { ok: false; error: "taken" | "generic" | "forbidden" }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./security.server");
    const { createStaffAccount } = await import("./staff-accounts.server");
    const ctx = ctxOf(context);
    const actor = await requireRole(ctx, "system_admin", "hospital_admin");
    if (!assignableRoles(actor).includes(data.role)) return { ok: false, error: "forbidden" };

    // Hospital admins always add to their own hospital; staff can't pick another.
    const facilityId = actor.roles.includes("hospital_admin") ? actor.facilityId : (data.facilityId ?? null);
    if (!facilityId) return { ok: false, error: "forbidden" };
    const { data: facility } = await supabaseAdmin.from("facilities").select("id, is_active").eq("id", facilityId).maybeSingle();
    if (!facility?.is_active) return { ok: false, error: "forbidden" };

    const res = await createStaffAccount({
      role: data.role,
      facilityId,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      staffId: data.staffId,
      licenceNumber: data.licenceNumber,
      cadre: data.cadre,
      ward: data.ward,
      createdBy: ctx.userId,
    });
    if (!res.ok) return res;
    await audit({
      action: "staff.created",
      actorUserId: ctx.userId,
      actorRole: actor.roles.includes("hospital_admin") ? "hospital_admin" : "system_admin",
      facilityId,
      entityType: "user",
      entityId: res.userId,
      metadata: { role: data.role },
    });
    return { ok: true, tempPassword: res.tempPassword };
  });

async function loadManageable(ctx: AuthedContext, userId: string) {
  const { requireRole, ForbiddenError } = await import("./guards.server");
  const { loadTarget } = await import("./staff-accounts.server");
  const actor = await requireRole(ctx, "system_admin", "hospital_admin");
  const target = await loadTarget(userId);
  if (!target || !canManageStaffMember(actor, target)) throw new ForbiddenError();
  return { actor, target };
}

export const changeStaffRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), role: z.enum(["hospital_admin", "clinician"]) }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: "forbidden" }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit, revokeVerifiedSessions } = await import("./security.server");
    const ctx = ctxOf(context);
    const { actor, target } = await loadManageable(ctx, data.userId);
    // Only hospital admins switch staff between doctor/nurse and admin.
    // CHVs sign in by phone, so they need a separate account.
    if (!actor.roles.includes("hospital_admin") || target.roles.includes("chv")) return { ok: false, error: "forbidden" };
    const from = target.roles.find((r) => r === "clinician" || r === "hospital_admin") ?? null;
    if (from === data.role) return { ok: true };
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).in("role", ["clinician", "hospital_admin"]);
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role, facility_id: target.facilityId, created_by: ctx.userId });
    // New permissions apply from the next sign-in.
    await revokeVerifiedSessions(data.userId);
    await audit({
      action: "staff.role_changed",
      actorUserId: ctx.userId,
      actorRole: "hospital_admin",
      facilityId: target.facilityId,
      entityType: "user",
      entityId: data.userId,
      metadata: { from, to: data.role },
    });
    return { ok: true };
  });

export const setStaffActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { audit } = await import("./security.server");
    const { setAccountActive } = await import("./staff-accounts.server");
    const ctx = ctxOf(context);
    const { actor, target } = await loadManageable(ctx, data.userId);
    await setAccountActive(data.userId, data.active);
    await audit({
      action: data.active ? "staff.reactivated" : "staff.deactivated",
      actorUserId: ctx.userId,
      actorRole: actor.roles.includes("hospital_admin") ? "hospital_admin" : "system_admin",
      facilityId: target.facilityId,
      entityType: "user",
      entityId: data.userId,
    });
    return { ok: true };
  });

export const issueTemporaryPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; tempPassword: string } | { ok: false; error: "forbidden" | "generic" }> => {
    const { audit } = await import("./security.server");
    const { issueTemporaryPasswordFor } = await import("./staff-accounts.server");
    const ctx = ctxOf(context);
    const { actor, target } = await loadManageable(ctx, data.userId);
    if (target.roles.includes("chv")) return { ok: false, error: "forbidden" };
    const temp = await issueTemporaryPasswordFor(data.userId);
    if (!temp) return { ok: false, error: "generic" };
    await audit({
      action: "staff.temporary_password_issued",
      actorUserId: ctx.userId,
      actorRole: actor.roles.includes("hospital_admin") ? "hospital_admin" : "system_admin",
      facilityId: target.facilityId,
      entityType: "user",
      entityId: data.userId,
    });
    return { ok: true, tempPassword: temp };
  });
