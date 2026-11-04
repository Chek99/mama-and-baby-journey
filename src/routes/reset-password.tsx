import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { SuccessIllustration } from "@/components/brand";
import { FormMessage, Spinner, StepIndicator } from "@/components/common";
import { Button } from "@/components/ui/button";
import { completePasswordReset } from "@/lib/api";
import type { PublicAuthError } from "@/lib/auth-rules";
import { isPasswordAcceptable } from "@/lib/password-rules";
import { useI18n } from "@/lib/i18n";

// Reset link sent by the backend: /reset-password?token=<resetToken>
export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { token?: string } => (typeof s["token"] === "string" ? { token: s["token"] } : {}),
  head: () => ({
    meta: [
      { title: "Create a new password — Mama na Mtoto" },
      { name: "description", content: "Choose a new password for your health worker account." },
      { property: "og:title", content: "Create a new password — Mama na Mtoto" },
      { property: "og:description", content: "Choose a new password for your account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const { token } = Route.useSearch();
  const [state, setState] = useState<"ready" | "expired" | "done">(token ? "ready" : "expired");
  const email: string | null = null;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<PublicAuthError | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!token || !isPasswordAcceptable(password, { email }) || password !== confirm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await completePasswordReset({ data: { token, password } });
      if (res.ok) setState("done");
      else if (res.error === "expired") setState("expired");
      else setError(res.error);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout wide={false}>
      <div className="space-y-6">
        <StepIndicator step={state === "done" ? 3 : state === "ready" ? 3 : 2} label={t("reset.step", { n: 3 })} />
        {state === "expired" && (
          <div className="space-y-5">
            <FormMessage>{t("reset.expired")}</FormMessage>
            <Button asChild variant="role" size="lg" className="w-full">
              <Link to="/forgot-password">{t("reset.send")}</Link>
            </Button>
          </div>
        )}
        {state === "ready" && (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <h1 className="text-2xl font-extrabold">{t("reset.newTitle")}</h1>
            {error && <FormMessage>{t(`auth.error.${error}`)}</FormMessage>}
            <NewPasswordFields
              password={password}
              confirm={confirm}
              onPassword={setPassword}
              onConfirm={setConfirm}
              touched={touched}
              email={email}
            />
            <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />}
              {t("reset.submit")}
            </Button>
          </form>
        )}
        {state === "done" && (
          <div className="space-y-5 text-center">
            <SuccessIllustration />
            <h1 className="text-2xl font-extrabold">{t("reset.successTitle")}</h1>
            <p className="text-muted-foreground">{t("reset.successBody")}</p>
            <Button asChild variant="role" size="lg" className="w-full">
              <Link to="/auth" search={{ tab: "staff" }}>
                {t("auth.signInLink")}
              </Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
