import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortal } from "@/lib/me-query";

export const Route = createFileRoute("/facility")({
  ssr: false,
  head: () => ({ meta: [{ title: "Hospital admin — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, ["hospital_admin"]),
  component: Page,
});

function Page() {
  const me = Route.useRouteContext();
  return (
    <PortalShell me={me} title="Hospital admin">
      <p className="text-muted-foreground">You are signed in as a hospital admin. The staff list (add, change role, deactivate) is the next screen to build.</p>
    </PortalShell>
  );
}
