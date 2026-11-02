import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms of use — Mama na Mtoto" }, { name: "description", content: "Terms for using Mama na Mtoto." }] }),
  component: () => (
    <InfoPage title="Terms of use" draft>
      <p>By signing in you agree to these terms.</p>
      <h2>Using your account</h2>
      <ul>
        <li>Keep your password, backup codes and phone codes private. Do not share your account.</li>
        <li>Staff may open only the records they need for patient care.</li>
        <li>Report a lost phone or suspected misuse to your hospital admin straight away.</li>
      </ul>
      <h2>Health information</h2>
      <p>This app records and reminds. It does not replace the advice of a doctor or nurse. In an emergency, go to the nearest health facility.</p>
      <h2>Misuse</h2>
      <p>Access may be removed for anyone who misuses the system. All access is recorded in an audit log.</p>
      <h2>Changes</h2>
      <p>We may update these terms. Continued use means you accept the updated terms.</p>
    </InfoPage>
  ),
});
