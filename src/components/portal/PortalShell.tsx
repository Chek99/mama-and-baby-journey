import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { BrandMark } from "@/components/brand";
import { LanguageSwitch, OfflineBanner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { setMyLanguage, type MeDto } from "@/lib/account.functions";
import { signOutApp } from "@/lib/client-auth";
import { useI18n } from "@/lib/i18n";

/** Header + sign-out + idle timeout shared by every signed-in portal page. */
export function PortalShell({ me, title, children }: { me: MeDto; title: string; children: ReactNode }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const saveLanguage = useServerFn(setMyLanguage);

  const signOut = async () => {
    await signOutApp(queryClient);
    await navigate({ to: "/auth", search: { tab: "staff" }, replace: true });
  };

  useIdleTimeout(me.idleMinutes, () => {
    void signOut();
  });

  return (
    <div className="flex min-h-screen flex-col bg-auth accent-staff">
      <OfflineBanner />
      <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pt-4">
        <BrandMark name={t("app.name")} />
        <div className="flex items-center gap-3">
          <LanguageSwitch onChange={(l) => void saveLanguage({ data: { language: l } }).catch(() => undefined)} />
          <Button asChild variant="outline" size="sm">
            <Link to="/account">
              <UserRound className="size-4" aria-hidden="true" />
              {t("common.account")}
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            {t("common.signOut")}
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <div className="space-y-6 rounded-3xl bg-card p-5 shadow-card sm:p-8">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
            <p className="text-muted-foreground">
              {me.fullName}
              {me.facility ? ` · ${me.facility.name}` : ""}
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
