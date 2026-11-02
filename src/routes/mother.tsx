import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { requirePortal } from "@/lib/me-query";

export const Route = createFileRoute("/mother")({
  ssr: false,
  head: () => ({ meta: [{ title: "My home — Mama na Mtoto" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: ({ context }) => requirePortal(context.queryClient, ["mother"]),
  component: Page,
});

function Page() {
  const me = Route.useRouteContext();
  return (
    <PortalShell me={me} title="My home">
      <p className="text-muted-foreground">You are signed in. Your pregnancy and baby information will appear here in a later phase.</p>
    </PortalShell>
  );
}
