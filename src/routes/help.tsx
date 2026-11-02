import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & contact — Mama na Mtoto" }, { name: "description", content: "Get help signing in to Mama na Mtoto." }] }),
  component: () => (
    <InfoPage title="Help & contact">
      <h2>I am a mother or guardian</h2>
      <ul>
        <li>Use the phone number your clinic registered, then enter the code sent by text.</li>
        <li>No code? Wait a minute and try again, or visit your clinic. If you changed your number, ask the clinic to update it.</li>
        <li>First visit? Choose &ldquo;Activate your account&rdquo; on the sign-in page.</li>
      </ul>
      <h2>I am a health worker</h2>
      <ul>
        <li>Sign in with your email or staff ID and password, then enter the code sent to your email.</li>
        <li>Forgot your password? Use &ldquo;Forgot password&rdquo; on the sign-in page.</li>
        <li>Locked out or no access? Ask your hospital admin for a temporary password.</li>
      </ul>
      <h2>I am a hospital admin</h2>
      <p>Contact the system administrator for your region if you cannot sign in.</p>
    </InfoPage>
  ),
});
