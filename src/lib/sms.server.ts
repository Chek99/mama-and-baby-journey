/**
 * SMS sending behind a provider interface so providers can be swapped.
 * Africa's Talking is the first provider. Message bodies are never logged.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { keyedHash } from "./security.server";
import { isSmsTextSafe } from "./sms-templates";

export interface SmsSendResult {
  ok: boolean;
  messageId?: string | undefined;
  status: string;
  error?: string | undefined;
}

export interface SmsProvider {
  name: string;
  send(toE164: string, message: string): Promise<SmsSendResult>;
}

class AfricasTalkingProvider implements SmsProvider {
  name = "africastalking";
  constructor(
    private username: string,
    private apiKey: string,
    private senderId?: string,
  ) {}

  async send(toE164: string, message: string): Promise<SmsSendResult> {
    const host = this.username === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com";
    const body = new URLSearchParams({ username: this.username, to: toE164, message });
    if (this.senderId) body.set("from", this.senderId);
    try {
      const res = await fetch(`${host}/version1/messaging`, {
        method: "POST",
        headers: {
          apiKey: this.apiKey,
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      if (!res.ok) return { ok: false, status: `http_${res.status}`, error: (await res.text()).slice(0, 200) };
      const json = (await res.json()) as {
        SMSMessageData?: { Message?: string; Recipients?: { statusCode?: number; status?: string; messageId?: string }[] };
      };
      const r = json.SMSMessageData?.Recipients?.[0];
      if (!r) return { ok: false, status: "no_recipient", error: json.SMSMessageData?.Message?.slice(0, 200) };
      const ok = r.statusCode === 100 || r.statusCode === 101 || r.statusCode === 102;
      return { ok, messageId: r.messageId, status: r.status ?? String(r.statusCode), error: ok ? undefined : r.status };
    } catch (e) {
      return { ok: false, status: "network_error", error: e instanceof Error ? e.message.slice(0, 200) : "unknown" };
    }
  }
}

export function getSmsProvider(): SmsProvider | null {
  const username = process.env["AFRICASTALKING_USERNAME"];
  const apiKey = process.env["AFRICASTALKING_API_KEY"];
  if (!username || !apiKey) return null;
  return new AfricasTalkingProvider(username, apiKey, process.env["AFRICASTALKING_SENDER_ID"] || undefined);
}

/** Sends one SMS with up to 2 retries and writes a body-free log row. */
export async function sendSms(opts: {
  to: string;
  message: string;
  purpose: string;
  facilityId?: string | null;
}): Promise<boolean> {
  if (!isSmsTextSafe(opts.message)) {
    console.error("Blocked unsafe SMS wording for purpose", opts.purpose);
    return false;
  }
  const provider = getSmsProvider();
  if (!provider) return false;
  let result: SmsSendResult = { ok: false, status: "not_sent" };
  let attempts = 0;
  for (attempts = 1; attempts <= 3; attempts++) {
    result = await provider.send(opts.to, opts.message);
    if (result.ok) break;
  }
  await supabaseAdmin.from("sms_log").insert({
    provider: provider.name,
    provider_message_id: result.messageId ?? null,
    phone_hash: await keyedHash(`phone:${opts.to}`),
    purpose: opts.purpose,
    status: result.status,
    attempts: Math.min(attempts, 3),
    error: result.error ?? null,
    facility_id: opts.facilityId ?? null,
  });
  return result.ok;
}
