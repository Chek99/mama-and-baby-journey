/**
 * System admin actions: hospitals (facilities), audit log and settings.
 * Every handler re-checks the role on the server.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import type { AuthedContext } from "./guards.server";

export interface FacilityDto {
  id: string;
  name: string;
  mflCode: string | null;
  county: string;
  subCounty: string | null;
  ward: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  services: string[];
  isActive: boolean;
}

const ctxOf = (c: unknown) => c as AuthedContext;

export const listFacilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FacilityDto[]> => {
    const { requireRole } = await import("./guards.server");
    const ctx = ctxOf(context);
    await requireRole(ctx, "system_admin");
    const { data, error } = await ctx.supabase
      .from("facilities")
      .select("id, name, mfl_code, county, sub_county, ward, phone, email, address, services, is_active")
      .order("name");
    if (error) throw new Error("Could not load hospitals");
    return (data ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mflCode: f.mfl_code,
      county: f.county,
      subCounty: f.sub_county,
      ward: f.ward,
      phone: f.phone,
      email: f.email,
      address: f.address,
      services: f.services,
      isActive: f.is_active,
    }));
  });

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

const facilitySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(160),
  mflCode: z
    .string()
    .trim()
    .max(20)
    .regex(/^[0-9A-Za-z-]*$/)
    .optional()
    .transform((v) => (v ? v : null)),
  county: z.string().trim().min(2).max(80),
  subCounty: opt(80),
  ward: opt(80),
  phone: opt(30),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success),
  address: opt(300),
  services: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
});

export const saveFacility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => facilitySchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; id: string } | { ok: false; error: "mfl_taken" | "generic" }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./security.server");
    const ctx = ctxOf(context);
    await requireRole(ctx, "system_admin");
    const row = {
      name: data.name,
      mfl_code: data.mflCode,
      county: data.county,
      sub_county: data.subCounty,
      ward: data.ward,
      phone: data.phone,
      email: data.email,
      address: data.address,
      services: data.services,
    };
    const res = data.id
      ? await supabaseAdmin.from("facilities").update(row).eq("id", data.id).select("id").single()
      : await supabaseAdmin.from("facilities").insert({ ...row, created_by: ctx.userId }).select("id").single();
    if (res.error || !res.data) return { ok: false, error: res.error?.code === "23505" ? "mfl_taken" : "generic" };
    await audit({
      action: data.id ? "facility.updated" : "facility.created",
      actorUserId: ctx.userId,
      actorRole: "system_admin",
      facilityId: res.data.id,
      entityType: "facility",
      entityId: res.data.id,
    });
    return { ok: true, id: res.data.id };
  });

export const setFacilityActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sec = await import("./security.server");
    const ctx = ctxOf(context);
    await requireRole(ctx, "system_admin");
    await supabaseAdmin.from("facilities").update({ is_active: data.active }).eq("id", data.id);
    if (!data.active) {
      // Everyone at a deactivated hospital loses access straight away.
      const { data: people } = await supabaseAdmin.from("profiles").select("id").eq("facility_id", data.id);
      await Promise.all((people ?? []).map((p) => sec.revokeVerifiedSessions(p.id)));
    }
    await sec.audit({
      action: data.active ? "facility.reactivated" : "facility.deactivated",
      actorUserId: ctx.userId,
      actorRole: "system_admin",
      facilityId: data.id,
      entityType: "facility",
      entityId: data.id,
    });
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Audit log (system admin: all; hospital admin: own facility, enforced by RLS)
// ---------------------------------------------------------------------------
export interface AuditDto {
  id: number;
  at: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  facilityName: string | null;
  entityType: string | null;
  success: boolean;
  ip: string | null;
  device: string | null;
}

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ before: z.number().int().positive().optional(), action: z.string().trim().max(80).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ rows: AuditDto[]; hasMore: boolean }> => {
    const { requireRole } = await import("./guards.server");
    const ctx = ctxOf(context);
    const actor = await requireRole(ctx, "system_admin", "hospital_admin");
    const PAGE = 50;
    let q = ctx.supabase
      .from("audit_logs")
      .select("id, at, action, actor_user_id, actor_role, facility_id, entity_type, success, ip, device")
      .order("id", { ascending: false })
      .limit(PAGE + 1);
    if (!actor.roles.includes("system_admin")) q = q.eq("facility_id", actor.facilityId ?? "00000000-0000-0000-0000-000000000000");
    if (data.before) q = q.lt("id", data.before);
    if (data.action) q = q.ilike("action", `%${data.action}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error("Could not load audit log");
    const list = (rows ?? []).slice(0, PAGE);
    const actorIds = [...new Set(list.map((r) => r.actor_user_id).filter((v): v is string => !!v))];
    const facilityIds = [...new Set(list.map((r) => r.facility_id).filter((v): v is string => !!v))];
    const [{ data: people }, { data: facilities }] = await Promise.all([
      actorIds.length ? ctx.supabase.from("profiles").select("id, full_name").in("id", actorIds) : Promise.resolve({ data: [] }),
      facilityIds.length ? ctx.supabase.from("facilities").select("id, name").in("id", facilityIds) : Promise.resolve({ data: [] }),
    ]);
    const nameOf = new Map((people ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
    const facOf = new Map((facilities ?? []).map((f: { id: string; name: string }) => [f.id, f.name]));
    return {
      hasMore: (rows ?? []).length > PAGE,
      rows: list.map((r) => ({
        id: r.id,
        at: r.at,
        action: r.action,
        actorName: r.actor_user_id ? (nameOf.get(r.actor_user_id) ?? null) : null,
        actorRole: r.actor_role,
        facilityName: r.facility_id ? (facOf.get(r.facility_id) ?? null) : null,
        entityType: r.entity_type,
        success: r.success,
        ip: r.ip,
        device: r.device,
      })),
    };
  });

// ---------------------------------------------------------------------------
// System settings
// ---------------------------------------------------------------------------
export interface SettingDto {
  key: string;
  value: Json;
  description: string | null;
  updatedAt: string;
}

const SETTING_RULES: Record<string, z.ZodType<Json>> = {
  mother_can_view_full_schedule: z.boolean(),
  staff_idle_timeout_minutes: z.number().int().min(5).max(120),
  mother_idle_timeout_minutes: z.number().int().min(5).max(240),
};

export const getSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SettingDto[]> => {
    const { requireRole } = await import("./guards.server");
    const ctx = ctxOf(context);
    await requireRole(ctx, "system_admin");
    const { data } = await ctx.supabase.from("app_settings").select("key, value, description, updated_at").order("key");
    return (data ?? []).map((s) => ({ key: s.key, value: s.value, description: s.description, updatedAt: s.updated_at }));
  });

export const updateSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const base = z.object({ key: z.string(), value: z.unknown() }).parse(d);
    const rule = SETTING_RULES[base.key];
    if (!rule) throw new Error("Unknown setting");
    return { key: base.key, value: rule.parse(base.value) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireRole } = await import("./guards.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { audit } = await import("./security.server");
    const ctx = ctxOf(context);
    await requireRole(ctx, "system_admin");
    await supabaseAdmin
      .from("app_settings")
      .update({ value: data.value, updated_by: ctx.userId, updated_at: new Date().toISOString() })
      .eq("key", data.key);
    await audit({
      action: "settings.updated",
      actorUserId: ctx.userId,
      actorRole: "system_admin",
      entityType: "setting",
      entityId: data.key,
      metadata: { key: data.key, value: typeof data.value === "object" ? JSON.stringify(data.value) : (data.value as string | number | boolean) },
    });
    return { ok: true };
  });
