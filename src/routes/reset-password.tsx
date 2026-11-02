import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { SuccessIllustration } from "@/components/brand";
import { FormMessage, Spinner, StepIndicator } from "@/components/common";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { completePasswordReset } from "@/lib/auth.functions";
import { isPasswordAcceptable } from "@/lib/password-rules";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
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
  const complete = useServerFn(completePasswordReset);
  const [state, setState] = useState<"waiting" | "ready" | "expired" | "done">("waiting");
  const [email, setEmail] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let settled = false;
    const ready = (userEmail: string | null) => {
      settled = true;
      setEmail(userEmail);
      setState("ready");
    };
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) ready(session.user.email ?? null);
    });
    const hashError = window.location.hash.includes("error");
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session && !hashError) ready(data.session.user.email ?? null);
    });
    const timer = window.setTimeout(() => {
      if (!settled) setState("expired");
    }, hashError ? 0 : 5000);
    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isPasswordAcceptable(password, { email }) || password !== confirm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await complete({ data: { password } });
      if (res.ok) {
        await supabase.auth.signOut({ scope: "local" });
        setState("done");
      } else if (res.error === "expired") {
        setState("expired");
      } else {
        setError(t(`auth.error.${res.error}`));
      }
    } catch {
      setState("expired");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout wide={false}>
      <div className="space-y-6">
        <StepIndicator step={state === "done" ? 3 : state === "ready" ? 3 : 2} label={t("reset.step", { n: 3 })} />
        {state === "waiting" && (
          <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground" role="status">
            <Spinner /> {t("reset.waiting")}
          </div>
        )}
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
            {error && <FormMessage>{error}</FormMessage>}
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
