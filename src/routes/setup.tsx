import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { FieldError, FormMessage, PasswordInput, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bootstrapSystemAdmin, getSetupStatus } from "@/lib/api";
import { isPasswordAcceptable } from "@/lib/password-rules";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "First-time setup — Mama na Mtoto" },
      { name: "description", content: "Create the system administrator account for a new Mama na Mtoto installation." },
      { property: "og:title", content: "First-time setup — Mama na Mtoto" },
      { property: "og:description", content: "Create the system administrator account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: () => getSetupStatus(),
  component: SetupPage,
  errorComponent: () => <SetupPage />,
});

function SetupPage() {
  const { t } = useI18n();
  const status = Route.useLoaderData() as { needsSetup: boolean } | undefined;
  const bootstrap = bootstrapSystemAdmin;
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closed, setClosed] = useState(status ? !status.needsSetup : false);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const mismatch = touched && confirm !== password;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (fullName.trim().length < 2 || !emailOk || !isPasswordAcceptable(password, { email }) || confirm !== password) return;
    setBusy(true);
    setError(null);
    try {
      const res = await bootstrap({ data: { fullName, email, password } });
      if (res.ok) {
        toast.success(t("setup.done"));
        await navigate({ to: "/auth", search: { tab: "staff" } });
        return;
      }
      if (res.error === "closed") setClosed(true);
      else setError(t(`auth.error.${res.error}`));
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout wide={false}>
      {closed ? (
        <div className="space-y-5 text-center">
          <ShieldCheck className="mx-auto size-12 text-role" aria-hidden="true" />
          <FormMessage tone="info">{t("setup.closed")}</FormMessage>
          <Button asChild variant="role" size="lg" className="w-full">
            <Link to="/auth" search={{ tab: "staff" }}>
              {t("common.signIn")}
            </Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold">{t("setup.title")}</h1>
            <p className="text-muted-foreground">{t("setup.help")}</p>
          </div>
          {error && <FormMessage>{error}</FormMessage>}
          <div className="space-y-2">
            <Label htmlFor="fullName">{t("setup.fullName")}</Label>
            <Input id="fullName" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={touched && fullName.trim().length < 2} />
            {touched && fullName.trim().length < 2 && <FieldError id="fullName-error">{t("common.required")}</FieldError>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("setup.email")}</Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={touched && !emailOk} />
            {touched && !emailOk && <FieldError id="email-error">{t("common.required")}</FieldError>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <PasswordInput id="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordStrengthMeter password={password} email={email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">{t("reset.confirmPassword")}</Label>
            <PasswordInput id="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={mismatch} />
            {mismatch && <FieldError id="confirm-error">{t("reset.mismatch")}</FieldError>}
          </div>
          <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
            {busy && <Spinner />}
            {t("setup.create")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
