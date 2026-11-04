import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useFinishSignIn } from "@/components/auth/useFinishSignIn";
import { FormMessage, Spinner } from "@/components/common";
import { Button } from "@/components/ui/button";
import { confirmEmailLinkSignIn } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

// Email sign-in link sent by the backend: /verify-sign-in?c=<challengeId>&t=<linkToken>
export const Route = createFileRoute("/verify-sign-in")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { c?: string; t?: string } => ({
    ...(typeof s["c"] === "string" ? { c: s["c"] } : {}),
    ...(typeof s["t"] === "string" ? { t: s["t"] } : {}),
  }),
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
  const { c, t: token } = Route.useSearch();
  const finish = useFinishSignIn();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!c || !token) {
      setFailed(true);
      return;
    }
    void (async () => {
      try {
        const res = await confirmEmailLinkSignIn({ data: { challengeId: c, token } });
        if (!res.ok) throw new Error(res.error);
        await finish(res);
      } catch {
        setFailed(true);
      }
    })();
  }, [c, token, finish]);

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
