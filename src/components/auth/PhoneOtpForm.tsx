import { useState, type FormEvent } from "react";
import { MessageSquareText, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, Spinner } from "@/components/common";
import { CodeInput } from "./CodeInput";
import { useFinishSignIn } from "./useFinishSignIn";
import { requestPhoneCode, verifyPhoneCode } from "@/lib/api";
import type { PublicAuthError } from "@/lib/auth-rules";
import { useI18n } from "@/lib/i18n";
import { maskPhone, normalizeKenyanPhone } from "@/lib/phone";
import { useCountdown } from "@/hooks/use-countdown";

/** Phone number + SMS code. Used by mothers, guardians and CHVs, and for first-visit activation. */
export function PhoneOtpForm({ purpose, onToggleActivate }: { purpose: "sign_in" | "activate"; onToggleActivate: () => void }) {
  const { t, lang } = useI18n();
  const request = requestPhoneCode;
  const verify = verifyPhoneCode;
  const finish = useFinishSignIn();
  const { left, restart } = useCountdown(60);
  const [local, setLocal] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PublicAuthError | null>(null);
  const [touched, setTouched] = useState(false);
  const [showChanged, setShowChanged] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const normalized = normalizeKenyanPhone(local);
  const phoneInvalid = touched && !normalized;

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (!normalized) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await request({ data: { phone: normalized, purpose, language: lang } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (phone) setNotice(t("auth.resent"));
      setPhone(normalized);
      restart();
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const check = async (value?: string) => {
    if (!phone) return;
    setBusy(true);
    setError(null);
    try {
      const res = await verify({ data: { phone, code: value ?? code } });
      if (!res.ok) {
        setError(res.error);
        setCode("");
        return;
      }
      await finish(res);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const heading = purpose === "activate" ? t("auth.activateTitle") : t("auth.motherTitle");
  const help = purpose === "activate" ? t("auth.activateHelp") : t("auth.motherHelp");

  if (phone) {
    return (
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
      >
        <div className="flex items-start gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-role-soft text-role-ink">
            <MessageSquareText className="size-6" aria-hidden="true" />
          </span>
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold">{t("auth.smsTitle")}</h1>
            <p id="sms-help" className="text-muted-foreground">
              {t("auth.smsSentTo", { phone: maskPhone(phone) })}
            </p>
          </div>
        </div>
        {error && <FormMessage>{t(`auth.error.${error}`)}</FormMessage>}
        {notice && <FormMessage tone="success">{notice}</FormMessage>}
        <CodeInput
          id="sms-code"
          label={t("auth.codeLabel")}
          describedBy="sms-help"
          value={code}
          onChange={setCode}
          onComplete={(v) => void check(v)}
          disabled={busy}
        />
        <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy || code.length !== 6}>
          {busy && <Spinner />}
          {busy ? t("auth.verifying") : t("auth.verify")}
        </Button>
        <div className="space-y-3 rounded-2xl bg-muted/60 p-4 text-sm">
          <p className="font-bold">{t("auth.noCode")}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Button type="button" variant="link" disabled={left > 0 || busy} onClick={() => void send()}>
              {left > 0 ? t("auth.resendIn", { s: left }) : t("auth.resend")}
            </Button>
            <Button type="button" variant="coral" onClick={() => setShowChanged((s) => !s)} aria-expanded={showChanged}>
              {t("auth.changedNumber")}
            </Button>
          </div>
          {showChanged && <FormMessage tone="info">{t("auth.changedNumberHelp")}</FormMessage>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => {
            setPhone(null);
            setCode("");
            setError(null);
          }}
        >
          {t("auth.startOver")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={send} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{heading}</h1>
        <p className="text-muted-foreground">{help}</p>
      </div>
      {error && <FormMessage>{t(`auth.error.${error}`)}</FormMessage>}
      <div className="space-y-2">
        <Label htmlFor="phone">{t("auth.phone")}</Label>
        <div className="flex">
          <span className="flex items-center gap-1.5 rounded-l-xl border-2 border-r-0 border-input bg-muted px-3 font-bold">
            <Phone className="size-4" aria-hidden="true" />
            +254
          </span>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="712 345 678"
            className="rounded-l-none"
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            onBlur={() => local && setTouched(true)}
            aria-invalid={phoneInvalid}
            aria-describedby={phoneInvalid ? "phone-error" : "phone-hint"}
          />
        </div>
        {phoneInvalid ? (
          <FieldError id="phone-error">{t("auth.phoneInvalid")}</FieldError>
        ) : (
          <p id="phone-hint" className="text-sm text-muted-foreground">
            {t("auth.phoneHint")}
          </p>
        )}
      </div>
      <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? t("auth.sending") : t("auth.sendCode")}
      </Button>
      <div className="space-y-3 text-center text-sm">
        <Button type="button" variant="link" onClick={onToggleActivate}>
          {purpose === "activate" ? t("auth.signInLink") : t("auth.firstVisit")}
        </Button>
        <p className="text-muted-foreground">{t("auth.chvNote")}</p>
      </div>
    </form>
  );
}
