import { createFileRoute } from "@tanstack/react-router";
import { InfoPage } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy policy — Mama na Mtoto" }, { name: "description", content: "How Mama na Mtoto handles health information." }] }),
  component: () => (
    <InfoPage title="Privacy policy" draft>
      <p>Mama na Mtoto helps clinics, mothers and community health volunteers keep pregnancy, vaccine and child growth records. This page explains what we collect and why.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Staff: name, email or phone, staff ID, licence number and the hospital they work at.</li>
        <li>Mothers and guardians: name, phone number and the health records your clinic enters.</li>
        <li>Security records: sign-in attempts, devices, and an audit log of who viewed or changed records.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To show the right records to the right people at your clinic.</li>
        <li>To send sign-in codes and reminders. Text messages never contain test results or diagnoses.</li>
        <li>To keep the system safe and to investigate misuse.</li>
      </ul>
      <h2>Who can see your information</h2>
      <p>Only staff at the hospital that cares for you, and you. Other hospitals can see your record only with your consent, or in a documented emergency.</p>
      <h2>Your choices</h2>
      <p>You may ask your clinic to correct your information, export it, or erase it where the law allows. Contact your clinic or the address on the Help page.</p>
      <h2>Keeping it safe</h2>
      <p>Access is controlled by role, sessions end after a period of inactivity, and every access is recorded.</p>
    </InfoPage>
  ),
});
