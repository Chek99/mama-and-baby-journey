import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { RoleTabs, type SignInTab } from "@/components/auth/RoleTabs";
import { StaffLoginForm } from "@/components/auth/StaffLoginForm";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { tab?: SignInTab } => (s["tab"] === "mother" ? { tab: "mother" } : s["tab"] === "staff" ? { tab: "staff" } : {}),
  head: () => ({
    meta: [
      { title: "Sign in — Mama na Mtoto" },
      { name: "description", content: "Health workers sign in with email or staff ID. Mothers, guardians and CHVs sign in with an SMS code." },
      { property: "og:title", content: "Sign in — Mama na Mtoto" },
      { property: "og:description", content: "Sign in as a health worker or as a mother / guardian." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { tab = "staff" } = Route.useSearch();
  const navigate = useNavigate({ from: "/auth" });
  const [purpose, setPurpose] = useState<"sign_in" | "activate">("sign_in");

  const setTab = (next: SignInTab) => void navigate({ search: { tab: next }, replace: true });

  return (
    <AuthLayout accent={tab === "mother" ? "mother" : "staff"}>
      <div className="space-y-6">
        <RoleTabs value={tab} onChange={setTab} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === "staff" ? (
            <StaffLoginForm />
          ) : (
            <PhoneOtpForm key={purpose} purpose={purpose} onToggleActivate={() => setPurpose((p) => (p === "activate" ? "sign_in" : "activate"))} />
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
