/**
 * Password history (last 5) and password updates. Server-only.
 * Passwords themselves are hashed by the auth service; history uses bcrypt.
 */
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PASSWORD_HISTORY_DEPTH } from "./password-rules";

export async function isReusedPassword(userId: string, password: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("password_history")
    .select("hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(PASSWORD_HISTORY_DEPTH);
  for (const row of data ?? []) {
    if (await bcrypt.compare(password, row.hash)) return true;
  }
  return false;
}

export async function recordPassword(userId: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  await supabaseAdmin.from("password_history").insert({ user_id: userId, hash });
  // Keep only the most recent entries.
  const { data } = await supabaseAdmin
    .from("password_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(PASSWORD_HISTORY_DEPTH, 100);
  if (data && data.length) {
    await supabaseAdmin.from("password_history").delete().in("id", data.map((r) => r.id));
  }
}

export async function setUserPassword(userId: string, password: string): Promise<boolean> {
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("password update failed", error.message);
    return false;
  }
  await recordPassword(userId, password);
  return true;
}
