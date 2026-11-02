import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Baby, HeartPulse, Syringe } from "lucide-react";
import { BrandMark, MotherBabyIllustration } from "@/components/brand";
import { LanguageSwitch, OfflineBanner } from "@/components/common";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const APP_VERSION = "0.1.0";

export function AuthFooter() {
  const { t } = useI18n();
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-muted-foreground">
      <Link to="/privacy" className="font-semibold hover:text-foreground hover:underline">
        {t("common.privacy")}
      </Link>
      <Link to="/terms" className="font-semibold hover:text-foreground hover:underline">
        {t("common.terms")}
      </Link>
      <Link to="/help" className="font-semibold hover:text-foreground hover:underline">
        {t("common.help")}
      </Link>
      <span>
        {t("app.version")} {APP_VERSION}
      </span>
    </footer>
  );
}

/** Gradient page with a two-column card on desktop and a single column on phones. */
export function AuthLayout({ children, accent = "staff", wide = true }: { children: ReactNode; accent?: "staff" | "mother"; wide?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={cn("flex min-h-screen flex-col bg-auth", accent === "mother" ? "accent-mother" : "accent-staff")}>
      <OfflineBanner />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 pt-4 sm:pt-6">
        <Link to="/" aria-label={t("app.name")}>
          <BrandMark name={t("app.name")} />
        </Link>
        <LanguageSwitch />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-6 sm:items-center sm:py-10">
        <div
          className={cn(
            "grid w-full overflow-hidden rounded-3xl bg-card shadow-card animate-card-in",
            wide ? "max-w-5xl md:grid-cols-[1fr_1.1fr]" : "max-w-lg",
          )}
        >
          {wide && (
            <aside className="relative flex flex-col items-center justify-center gap-4 bg-role-soft px-6 py-5 text-center md:gap-6 md:py-10">
              <MotherBabyIllustration className="hidden w-full max-w-[300px] md:block" />
              <MotherBabyIllustration className="w-28 md:hidden" />
              <div className="space-y-2">
                <h2 className="text-2xl font-extrabold md:text-3xl">{t("app.name")}</h2>
                <p className="mx-auto max-w-xs text-base text-muted-foreground">{t("app.tagline")}</p>
              </div>
              <ul className="hidden w-full max-w-xs gap-3 md:grid">
                {[
                  { icon: HeartPulse, label: t("app.benefit1"), cls: "bg-coral-soft text-coral-ink" },
                  { icon: Syringe, label: t("app.benefit2"), cls: "bg-sunny-soft text-warning-ink" },
                  { icon: Baby, label: t("app.benefit3"), cls: "bg-lavender-soft text-lavender-ink" },
                ].map(({ icon: Icon, label, cls }) => (
                  <li key={label} className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left font-bold shadow-soft">
                    <span className={cn("flex size-10 items-center justify-center rounded-xl", cls)}>
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </aside>
          )}
          <section className="px-5 py-7 sm:px-10 sm:py-10">{children}</section>
        </div>
      </main>
      <AuthFooter />
    </div>
  );
}
