import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortal } from "@/lib/me-query";

export const Route = createFileRoute("/chv")({
  ssr: false,
  head: () => ({ meta: [{ title: "Community health volunteer home — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, ["chv"]),
  component: Page,
});

function Page() {
  const me = Route.useRouteContext();
  return (
    <PortalShell me={me} title="Community health volunteer home">
      <p className="text-muted-foreground">You are signed in. Household visits and referrals arrive in a later phase.</p>
    </PortalShell>
  );
}
