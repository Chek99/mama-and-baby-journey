import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { applySession, asPortal, saveDeviceToken } from "@/lib/client-auth";

export function useFinishSignIn() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (opts: {
    session?: { access_token: string; refresh_token: string } | undefined;
    portal: string;
    mustChangePassword?: boolean | undefined;
    deviceToken?: string | undefined;
  }) => {
    if (opts.session) await applySession(opts.session);
    saveDeviceToken(opts.deviceToken);
    queryClient.removeQueries({ queryKey: ["me"] });
    if (opts.mustChangePassword) {
      await navigate({ to: "/change-password", replace: true });
      return;
    }
    await navigate({ to: asPortal(opts.portal), replace: true });
  };
}
