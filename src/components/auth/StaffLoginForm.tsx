import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage, PasswordInput, Spinner } from "@/components/common";
import { CodeInput } from "./CodeInput";
import { useFinishSignIn } from "./useFinishSignIn";
import { resendStaffCode, staffLoginStart, staffLoginUseBackupCode, staffLoginVerifyCode } from "@/lib/auth.functions";
import type { PublicAuthError } from "@/lib/auth-rules";
import { getDeviceToken } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n";
import { useCountdown } from "@/hooks/use-countdown";

export function StaffLoginForm() {
  const { t } = useI18n();
  const start = useServerFn(staffLoginStart);
  const finish = useFinishSignIn();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PublicAuthError | null>(null);
  const [touched, setTouched] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; maskedEmail: string } | null>(null);

  const identifierMissing = touched && !identifier.trim();
  const passwordMissing = touched && !password;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!identifier.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await start({ data: { identifier, password, rememberDevice: remember, deviceToken: getDeviceToken() } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.step === "done") {
        await finish({ session: res.session, portal: res.portal, mustChangePassword: res.mustChangePassword });
        return;
      }
      setPassword("");
      setChallenge({ id: res.challengeId, maskedEmail: res.maskedEmail });
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  if (challenge) {
    return <TwoFactorStep challengeId={challenge.id} maskedEmail={challenge.maskedEmail} onRestart={() => setChallenge(null)} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("auth.staffTitle")}</h1>
        <p className="text-muted-foreground">{t("auth.staffHelp")}</p>
      </div>
      {error && <FormMessage>{t(`auth.error.${error}`)}</FormMessage>}
      <div className="space-y-2">
        <Label htmlFor="identifier">{t("auth.identifier")}</Label>
        <Input
          id="identifier"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          aria-invalid={identifierMissing}
          aria-describedby={identifierMissing ? "identifier-error" : undefined}
        />
        {identifierMissing && <FieldError id="identifier-error">{t("common.required")}</FieldError>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Link to="/forgot-password" className="text-sm font-bold text-coral-ink hover:underline">
            {t("auth.forgot")}
          </Link>
        </div>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-invalid={passwordMissing}
          aria-describedby={passwordMissing ? "password-error" : undefined}
        />
        {passwordMissing && <FieldError id="password-error">{t("common.required")}</FieldError>}
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} className="mt-0.5 size-5" />
        <div className="space-y-0.5">
          <Label htmlFor="remember" className="font-semibold">
            {t("auth.rememberDevice")}
          </Label>
          <p className="text-sm text-muted-foreground">{t("auth.rememberHint")}</p>
        </div>
      </div>
      <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
        {busy && <Spinner />}
        {busy ? t("auth.signingIn") : t("common.signIn")}
      </Button>
    </form>
  );
}

function TwoFactorStep({ challengeId, maskedEmail, onRestart }: { challengeId: string; maskedEmail: string; onRestart: () => void }) {
  const { t } = useI18n();
  const verify = useServerFn(staffLoginVerifyCode);
  const verifyBackup = useServerFn(staffLoginUseBackupCode);
  const resend = useServerFn(resendStaffCode);
  const finish = useFinishSignIn();
  const { left, restart } = useCountdown(60);
  const [mode, setMode] = useState<"code" | "backup">("code");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PublicAuthError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (value?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        mode === "code"
          ? await verify({ data: { challengeId, code: value ?? code } })
          : await verifyBackup({ data: { challengeId, backupCode: backup } });
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

  const onResend = async () => {
    setError(null);
    try {
      const res = await resend({ data: { challengeId } });
      if (!res.ok) setError(res.error);
      else setNotice(t("auth.resent"));
    } catch {
      setError("generic");
    }
    restart();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-5"
      noValidate
    >
      <div className="flex items-start gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-role-soft text-role-ink">
          <MailCheck className="size-6" aria-hidden="true" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold">{t("auth.codeTitle")}</h1>
          <p className="text-muted-foreground" id="code-help">
            {t("auth.codeSentTo", { email: maskedEmail })} {t("auth.codeLinkHint")}
          </p>
        </div>
      </div>
      {error && <FormMessage>{t(`auth.error.${error}`)}</FormMessage>}
      {notice && <FormMessage tone="success">{notice}</FormMessage>}

      {mode === "code" ? (
        <div className="space-y-2">
          <Label htmlFor="code" className="sr-only">
            {t("auth.codeLabel")}
          </Label>
          <CodeInput
            id="code"
            label={t("auth.codeLabel")}
            describedBy="code-help"
            value={code}
            onChange={setCode}
            onComplete={(v) => void submit(v)}
            disabled={busy}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="backup">{t("auth.backupLabel")}</Label>
          <Input
            id="backup"
            autoFocus
            autoComplete="off"
            value={backup}
            onChange={(e) => setBackup(e.target.value)}
            placeholder="xxxxx-xxxxx"
            className="font-mono tracking-wider"
          />
        </div>
      )}

      <Button
        type="submit"
        variant="role"
        size="lg"
        className="w-full"
        disabled={busy || (mode === "code" ? code.length !== 6 : backup.trim().length < 6)}
      >
        {busy && <Spinner />}
        {busy ? t("auth.verifying") : t("auth.verify")}
      </Button>

      <div className="flex flex-col items-center gap-3 text-sm">
        {mode === "code" && (
          <Button type="button" variant="link" onClick={onResend} disabled={left > 0}>
            {left > 0 ? t("auth.resendIn", { s: left }) : t("auth.resend")}
          </Button>
        )}
        <Button
          type="button"
          variant="link"
          onClick={() => {
            setMode(mode === "code" ? "backup" : "code");
            setError(null);
          }}
        >
          {mode === "code" ? t("auth.useBackup") : t("auth.useCode")}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onRestart}>
          {t("auth.startOver")}
        </Button>
      </div>
    </form>
  );
}
