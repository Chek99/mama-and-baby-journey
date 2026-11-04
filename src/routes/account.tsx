import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { NewPasswordFields } from "@/components/auth/NewPasswordFields";
import { FormMessage, PasswordInput, Spinner } from "@/components/common";
import { PortalShell } from "@/components/portal/PortalShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { backupCodeStatus, changePassword, generateBackupCodes, signOutEverywhere } from "@/lib/api";
import { asPortal, signOutApp } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n";
import { requirePortal } from "@/lib/me-query";
import { isPasswordAcceptable } from "@/lib/password-rules";

export const Route = createFileRoute("/account")({
  ssr: false,
  head: () => ({ meta: [{ title: "My account — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, "any"),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useI18n();
  const me = Route.useRouteContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const everywhere = signOutEverywhere;

  const leaveAll = async () => {
    try {
      await everywhere();
    } finally {
      await signOutApp(queryClient);
      await navigate({ to: "/auth", search: { tab: "staff" }, replace: true });
    }
  };

  return (
    <PortalShell me={me} title={t("account.title")}>
      <Button type="button" variant="link" onClick={() => void navigate({ to: asPortal(me.portal) })}>
        ← {t("common.home")}
      </Button>
      {me.usesPassword && <PasswordSection email={me.email} />}
      {me.usesPassword && <BackupCodes />}
      <section className="space-y-2">
        <h2 className="text-xl font-extrabold">{t("account.signOutEverywhere")}</h2>
        <p className="text-muted-foreground">{t("account.signOutEverywhereHelp")}</p>
        <Button type="button" variant="destructive" onClick={() => void leaveAll()}>
          {t("account.signOutEverywhere")}
        </Button>
      </section>
    </PortalShell>
  );
}

function PasswordSection({ email }: { email: string | null }) {
  const { t } = useI18n();
  const change = changePassword;
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!current || !isPasswordAcceptable(password, { email }) || password !== confirm) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await change({ data: { currentPassword: current, newPassword: password } });
      if (res.ok) {
        setCurrent("");
        setPassword("");
        setConfirm("");
        setTouched(false);
        setMsg({ tone: "success", text: t("account.passwordChanged") });
      } else {
        setMsg({ tone: "error", text: t(`auth.error.${res.error}`) });
      }
    } catch {
      setMsg({ tone: "error", text: t("common.somethingWrong") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-lg space-y-4">
      <h2 className="text-xl font-extrabold">{t("account.changePassword")}</h2>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        {msg && <FormMessage tone={msg.tone}>{msg.text}</FormMessage>}
        <div className="space-y-2">
          <Label htmlFor="current-password">{t("account.currentPassword")}</Label>
          <PasswordInput id="current-password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <NewPasswordFields password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} touched={touched} email={email} />
        <Button type="submit" variant="role" disabled={busy}>
          {busy && <Spinner />}
          {t("account.changePassword")}
        </Button>
      </form>
    </section>
  );
}

function BackupCodes() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const status = backupCodeStatus;
  const generate = generateBackupCodes;
  const { data } = useQuery({ queryKey: ["backup-status"], queryFn: () => status() });
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      const res = await generate();
      setCodes(res.codes);
      void queryClient.invalidateQueries({ queryKey: ["backup-status"] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-lg space-y-3">
      <h2 className="text-xl font-extrabold">{t("account.backupTitle")}</h2>
      <p className="text-muted-foreground">{t("account.backupHelp")}</p>
      {data && <p className="font-semibold">{t("account.backupRemaining", { n: data.remaining })}</p>}
      {codes && (
        <div className="space-y-2 rounded-2xl border-2 border-dashed border-sunny bg-sunny-soft p-4">
          <p className="font-bold">{t("account.backupShownOnce")}</p>
          <ul className="grid grid-cols-2 gap-2 font-mono text-lg font-bold">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      <Button type="button" variant="outline" disabled={busy} onClick={() => void make()}>
        {busy && <Spinner />}
        {t("account.backupGenerate")}
      </Button>
    </section>
  );
}
