import { useSuspenseQuery } from "@tanstack/react-query";
import { Sprout } from "lucide-react";
import { AppShell, EmptyState, PageHeader } from "@/components/AppShell";
import { meQueryOptions } from "@/lib/me-query";
import { useI18n, type TKey } from "@/lib/i18n";

/** Empty portal home. Content arrives in later phases. */
export function PortalHome({ title }: { title: TKey }) {
  const { t } = useI18n();
  const { data: me } = useSuspenseQuery(meQueryOptions);
  return (
    <AppShell>
      <PageHeader title={t(title)} subtitle={t("portal.welcome", { name: me.fullName })} />
      <EmptyState icon={<Sprout className="size-8" aria-hidden="true" />}>{t("portal.comingSoon")}</EmptyState>
    </AppShell>
  );
}
