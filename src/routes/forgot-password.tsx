import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { FieldError, FormMessage, Spinner, StepIndicator } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — Mama na Mtoto" },
      { name: "description", content: "Health workers can request a password reset link by email." },
      { property: "og:title", content: "Forgot password — Mama na Mtoto" },
      { property: "og:description", content: "Request a password reset link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { t } = useI18n();
  const request = useServerFn(requestPasswordReset);
  const [identifier, setIdentifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (identifier.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await request({ data: { identifier } });
      if (res.ok) setSent(true);
      else setError(t(`auth.error.${res.error}`));
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout wide={false}>
      <div className="space-y-6">
        <StepIndicator step={sent ? 2 : 1} label={t("reset.step", { n: sent ? 2 : 1 })} />
        {sent ? (
          <div className="space-y-5 text-center">
            <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-role-soft text-role-ink">
              <MailCheck className="size-8" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-extrabold">{t("reset.sentTitle")}</h1>
            <FormMessage tone="info">{t("reset.sent")}</FormMessage>
            <Button asChild variant="role" size="lg" className="w-full">
              <Link to="/auth" search={{ tab: "staff" }}>
                {t("auth.signInLink")}
              </Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <div className="space-y-1">
              <h1 className="text-2xl font-extrabold">{t("reset.forgotTitle")}</h1>
              <p className="text-muted-foreground">{t("reset.forgotHelp")}</p>
            </div>
            {error && <FormMessage>{error}</FormMessage>}
            <div className="space-y-2">
              <Label htmlFor="identifier">{t("auth.identifier")}</Label>
              <Input
                id="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-invalid={touched && identifier.trim().length < 2}
                aria-describedby={touched && identifier.trim().length < 2 ? "identifier-error" : undefined}
              />
              {touched && identifier.trim().length < 2 && <FieldError id="identifier-error">{t("common.required")}</FieldError>}
            </div>
            <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {t("reset.send")}
            </Button>
            <div className="text-center">
              <Link to="/auth" search={{ tab: "staff" }} className="font-bold text-role-ink hover:underline">
                {t("auth.signInLink")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
