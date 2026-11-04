import { useState, type FormEvent } from "react";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { FormMessage, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { changePassword } from "@/lib/api";
import { asPortal } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n";
import { meQueryOptions } from "@/lib/me-query";
import { isPasswordAcceptable } from "@/lib/password-rules";

export const Route = createFileRoute("/change-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Change password — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  // Not requirePortal: that sends users who must change their password here, which would loop.
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me.verified) throw redirect({ to: "/auth" });
    return me;
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { t } = useI18n();
  const me = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const change = changePassword;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isPasswordAcceptable(password, { email: me.email }) || password !== confirm) return;
    setBusy(true);
    setError(null);
    try {
      const res = await change({ data: { newPassword: password } });
      if (res.ok) {
        queryClient.removeQueries({ queryKey: ["me"] });
        await navigate({ to: asPortal(me.portal), replace: true });
      } else {
        setError(t(`auth.error.${res.error}`));
      }
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout wide={false}>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <h1 className="text-2xl font-extrabold">{t("reset.newTitle")}</h1>
        {error && <FormMessage>{error}</FormMessage>}
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} touched={touched} email={me.email} />
        <Button type="submit" variant="role" size="lg" className="w-full" disabled={busy}>
          {busy && <Spinner />}
          {t("reset.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
