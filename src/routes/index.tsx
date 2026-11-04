import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, HeartHandshake, Settings2, Stethoscope } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { getSetupStatus } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mama na Mtoto — care for every mother and child" },
      { name: "description", content: "Sign in to track pregnancy, vaccines and your baby's growth with your clinic in Kenya." },
      { property: "og:title", content: "Mama na Mtoto — care for every mother and child" },
      { property: "og:description", content: "Track pregnancy, vaccines and your baby's growth with your clinic in Kenya." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: () => getSetupStatus(),
  component: Index,
  errorComponent: () => <Index />,
});

function Index() {
  const { t } = useI18n();
  const status = Route.useLoaderData() as { needsSetup: boolean } | undefined;
  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold sm:text-4xl">{t("auth.motherTitle")}</h1>
          <p className="text-lg text-muted-foreground">{t("app.tagline")}</p>
        </div>
        {status?.needsSetup && (
          <Link
            to="/setup"
            className="flex items-center gap-4 rounded-2xl border-2 border-dashed border-sunny bg-sunny-soft p-4 font-bold hover:bg-sunny-soft/70"
          >
            <Settings2 className="size-6 shrink-0" aria-hidden="true" />
            <span className="flex-1">{t("setup.title")}</span>
            <ArrowRight className="size-5" aria-hidden="true" />
          </Link>
        )}
        <div className="grid gap-3">
          <Link
            to="/auth"
            search={{ tab: "staff" }}
            className="group flex min-h-20 items-center gap-4 rounded-2xl bg-teal-soft p-4 text-primary ring-primary transition hover:ring-2"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Stethoscope className="size-6" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-extrabold">{t("auth.tabStaff")}</span>
              <span className="block text-sm text-foreground/80">{t("auth.staffHelp")}</span>
            </span>
            <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
          </Link>
          <Link
            to="/auth"
            search={{ tab: "mother" }}
            className="group flex min-h-20 items-center gap-4 rounded-2xl bg-lavender-soft p-4 text-lavender-ink ring-lavender-ink transition hover:ring-2"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-lavender-ink text-primary-foreground">
              <HeartHandshake className="size-6" aria-hidden="true" />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-extrabold">{t("auth.tabMother")}</span>
              <span className="block text-sm text-foreground/80">{t("auth.chvNote")}</span>
            </span>
            <ArrowRight className="size-5 transition group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
