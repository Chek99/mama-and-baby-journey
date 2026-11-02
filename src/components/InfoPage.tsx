import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AuthFooter } from "@/components/auth/AuthLayout";
import { BrandMark } from "@/components/brand";
import { LanguageSwitch, OfflineBanner } from "@/components/common";
import { useI18n } from "@/lib/i18n";

export function InfoPage({ title, children, draft }: { title: string; children: ReactNode; draft?: boolean }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-auth">
      <OfflineBanner />
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 pt-6">
        <Link to="/" aria-label={t("app.name")}>
          <BrandMark name={t("app.name")} />
        </Link>
        <LanguageSwitch />
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <article className="space-y-5 rounded-3xl bg-card p-6 shadow-card sm:p-10 [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-foreground/90">
          <h1 className="text-3xl font-extrabold">{title}</h1>
          {draft && (
            <p className="rounded-xl bg-sunny-soft px-4 py-3 text-sm font-bold text-warning-ink">
              Draft for legal review — not yet final. / Rasimu kwa ukaguzi wa kisheria.
            </p>
          )}
          {children}
        </article>
      </main>
      <AuthFooter />
    </div>
  );
}
