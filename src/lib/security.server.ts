/**
 * Server-only security helpers: hashing, random codes, rate limits, audit log,
 * request metadata and session minting. Never import from client code.
 */
import { createClient, type Session } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { LOCKOUT_MINUTES, VERIFIED_SESSION_HOURS } from "./auth-rules";

// ---------------------------------------------------------------------------
// Request metadata (IP and device) for audit and rate limits
// ---------------------------------------------------------------------------
export function requestMeta(): { ip: string; device: string; origin: string } {
  const req = getRequest();
  const h = req?.headers;
  const ip =
    h?.get("cf-connecting-ip") ||
    h?.get("x-real-ip") ||
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const device = (h?.get("user-agent") || "unknown").slice(0, 200);
  let origin = h?.get("origin") || "";
  if (!origin && req?.url) {
    try {
      origin = new URL(req.url).origin;
    } catch {
      origin = "";
    }
  }
  return { ip, device, origin };
}

// ---------------------------------------------------------------------------
// Hashing and randomness
// ---------------------------------------------------------------------------
function pepper(): string {
  const p = process.env["CODE_HASH_PEPPER"];
  if (!p) throw new Error("Server is missing CODE_HASH_PEPPER");
  return p;
}

/** Keyed SHA-256 (HMAC) hex digest. Used for codes, tokens and phone lookups. */
export async function keyedHash(value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(pepper()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Uniform random digits using rejection sampling. */
export function randomDigits(length: number): string {
  let out = "";
  const buf = new Uint8Array(1);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    const b = buf[0]!;
    if (b < 250) out += String(b % 10);
  }
  return out;
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Temporary password that already satisfies the password rules. */
export function temporaryPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const all = letters + digits;
  const pick = (set: string) => {
    const b = new Uint32Array(1);
    crypto.getRandomValues(b);
    return set[b[0]! % set.length]!;
  };
  let pw = pick(letters) + pick(letters) + pick(digits) + pick(digits);
  while (pw.length < 12) pw += pick(all);
  return pw
    .split("")
    .sort(() => (randomDigits(1) < "5" ? -1 : 1))
    .join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------------------------------------------------------------------------
// Rate limits
// ---------------------------------------------------------------------------
/** Records one attempt. Returns true when the key is locked out. */
export async function rateLimited(key: string, max: number, windowSeconds = LOCKOUT_MINUTES * 60): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("rate_limit_hit", {
    _key: key,
    _max: max,
    _window_seconds: windowSeconds,
    _lock_seconds: LOCKOUT_MINUTES * 60,
  });
  if (error) {
    console.error("rate limit check failed", error.message);
    return false;
  }
  return data !== null;
}

// ---------------------------------------------------------------------------
// Audit log (append-only). Never pass passwords, tokens, codes or SMS bodies.
// ---------------------------------------------------------------------------
export interface AuditEntry {
  action: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  facilityId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  success?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function audit(entry: AuditEntry): Promise<void> {
  const meta = requestMeta();
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    action: entry.action,
    actor_user_id: entry.actorUserId ?? null,
    actor_role: entry.actorRole ?? null,
    facility_id: entry.facilityId ?? null,
    entity_type: entry.entityType ?? null,
    entity_id: entry.entityId ?? null,
    success: entry.success ?? true,
    ip: meta.ip,
    device: meta.device,
    metadata: entry.metadata ?? {},
  });
  if (error) console.error("audit insert failed", error.message);
}

// ---------------------------------------------------------------------------
// Auth clients and sessions
// ---------------------------------------------------------------------------
/** Publishable-key client for auth calls from the server. Never persists. */
export function publicAuthClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1] ?? "";
  const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as Record<string, unknown>;
}

/** Marks a session as having completed full sign-in (both factors). */
export async function markSessionVerified(accessToken: string, userId: string, method: string): Promise<void> {
  const claims = decodeJwtPayload(accessToken);
  const sessionId = claims["session_id"];
  if (typeof sessionId !== "string") throw new Error("Session has no id");
  const meta = requestMeta();
  const { error } = await supabaseAdmin.from("verified_sessions").insert({
    session_id: sessionId,
    user_id: userId,
    method,
    ip: meta.ip,
    device: meta.device,
    expires_at: new Date(Date.now() + VERIFIED_SESSION_HOURS * 3600 * 1000).toISOString(),
  });
  if (error) throw new Error("Could not record session");
}

/** Creates a fresh session for an existing user without sending any email. */
export async function mintSession(email: string): Promise<Session> {
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data?.properties?.hashed_token) throw new Error("Could not start session");
  const anon = publicAuthClient();
  const { data: v, error: vErr } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  if (vErr || !v.session) throw new Error("Could not start session");
  return v.session;
}

/** Revokes app access for all of a user's sessions (optionally keeping one). */
export async function revokeVerifiedSessions(userId: string, keepSessionId?: string): Promise<void> {
  let q = supabaseAdmin
    .from("verified_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
  if (keepSessionId) q = q.neq("session_id", keepSessionId);
  await q;
}

export function sessionDto(s: Session) {
  return { access_token: s.access_token, refresh_token: s.refresh_token };
}
