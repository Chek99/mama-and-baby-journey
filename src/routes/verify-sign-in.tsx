import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useFinishSignIn } from "@/components/auth/useFinishSignIn";
import { FormMessage, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { confirmEmailLinkSignIn } from "@/lib/auth.functions";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/verify-sign-in")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { c?: string } => (typeof s["c"] === "string" ? { c: s["c"] } : {}),
  head: () => ({
    meta: [
      { title: "Confirming sign-in — Mama na Mtoto" },
      { name: "description", content: "Confirming your sign-in from the email link." },
      { property: "og:title", content: "Confirming sign-in — Mama na Mtoto" },
      { property: "og:description", content: "Confirming your sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifySignInPage,
});

function VerifySignInPage() {
  const { t } = useI18n();
  const { c } = Route.useSearch();
  const confirm = useServerFn(confirmEmailLinkSignIn);
  const finish = useFinishSignIn();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const run = async () => {
      // The email link puts a session in the address; give the client a moment to read it.
      let session = (await supabase.auth.getSession()).data.session;
      for (let i = 0; !session && i < 10; i++) {
        await new Promise((r) => setTimeout(r, 300));
        session = (await supabase.auth.getSession()).data.session;
      }
      if (!session || !c) {
        setFailed(true);
        return;
      }
      try {
        const res = await confirm({ data: { challengeId: c } });
        if (!res.ok) throw new Error(res.error);
        await finish({ portal: res.portal, mustChangePassword: res.mustChangePassword, deviceToken: res.deviceToken });
      } catch {
        await supabase.auth.signOut({ scope: "local" });
        setFailed(true);
      }
    };
    void run();
  }, [c, confirm, finish]);

  return (
    <AuthLayout wide={false}>
      {failed ? (
        <div className="space-y-5">
          <FormMessage>{t("auth.linkFailed")}</FormMessage>
          <Button asChild variant="role" size="lg" className="w-full">
            <Link to="/auth" search={{ tab: "staff" }}>
              {t("auth.signInLink")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-3 py-8 text-muted-foreground" role="status">
          <Spinner /> {t("auth.linkConfirming")}
        </div>
      )}
    </AuthLayout>
  );
}
