import { createFileRoute } from "@tanstack/react-router";
import { PortalShell } from "@/components/portal/PortalShell";
import { StaffManager } from "@/components/portal/StaffManager";
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
    <PortalShell me={me} title="Staff">
      <StaffManager scope="facility" />
    </PortalShell>
  );
}
