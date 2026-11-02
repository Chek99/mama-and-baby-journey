import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortal } from "@/lib/me-query";

export const Route = createFileRoute("/clinician")({
  ssr: false,
  head: () => ({ meta: [{ title: "Clinic home — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, ["clinician"]),
  component: Page,
});

function Page() {
  const me = Route.useRouteContext();
  return (
    <PortalShell me={me} title="Clinic home">
      <p className="text-muted-foreground">You are signed in. Mothers, pregnancies and vaccines arrive in the next phase.</p>
    </PortalShell>
  );
}
