# Phase 1 proposal: Setup, accounts, roles, hospitals, staff, audit log, sign-in pages

Covers spec sections 1–3, 9, 10 (phase 1) and 13 (sign-in and password reset). Nothing clinical yet — mothers, pregnancies and children start in phase 2. No sample data: the app starts empty.

## One change from your spec (platform constraint)

Lovable runs a fixed stack, so the spec's tools map like this. Behaviour stays the same.

| Spec | What we use instead |
|---|---|
| React + Vite + Tailwind | Same (React 19, Vite, Tailwind v4) on TanStack Start |
| Node/Express REST API | Server functions in the same app (typed, validated with Zod) |
| PostgreSQL + Prisma | PostgreSQL on Lovable Cloud, SQL migrations, row-level security |
| JWT + refresh tokens | Lovable Cloud auth (short-lived access tokens, rotating refresh tokens) |
| BullMQ/Redis, node-cron | Scheduled database jobs calling a server endpoint (phase 6) |
| Africa's Talking SMS | Same, behind a swappable SMS interface |
| PWA/offline | Phase 9, as planned |

## How hospitals and admins get set up

1. First-run setup screen: on a brand-new install, the first person creates the **system admin** account. This screen then locks permanently.
2. System admin adds each hospital (facility) and invites that hospital's **hospital admin** by email.
3. Each hospital admin invites their own doctors/nurses and CHVs. Staff are tied to one hospital; they cannot choose another.
4. Mothers are not invited here — clinics register them in phase 2, then the mother activates with an SMS code.

## Screens in phase 1

- Sign in (Health Worker / Mother-Guardian tabs, English/Kiswahili switch, offline banner)
- Health Worker: email or staff ID + password, then 6-digit email code step (resend timer, backup code)
- Mother/Guardian: +254 phone, SMS code; "First visit?" activation; "Didn't get the code?" / "I changed my number"
- CHV: phone + SMS code
- Forgot password (3 steps, same message whether or not the account exists), Create new password with strength meter and checklist, success screen
- Forced password change (after an admin-issued temporary password)
- System admin: hospitals list/add/edit/deactivate, all hospital admins, audit log viewer, system settings (e.g. "mothers can see full vaccine schedule" flag, off)
- Hospital admin: staff list, invite, change role, deactivate immediately, issue temporary password
- Empty home screens for each portal (clinician, mother, CHV) so routing by role can be tested; content arrives in later phases
- Privacy policy, terms (drafts for legal review), help/contact

Skipped: the separate Storybook/demo page from 13.7 — it would need fake values. You review the real pages instead.

## Database tables (phase 1)

- **facilities** — name, MFL code (Kenya Master Facility List, unique), county, sub-county, ward, phone, email, services, active flag
- **profiles** — one per account: full name, phone, email, staff ID (unique), facility, licence/registration number, preferred language, active flag, must-change-password flag
- **user_roles** — separate table: system_admin, hospital_admin, clinician, chv, mother; facility for staff roles; ward for CHVs
- **staff_invites** — email/phone, role, facility, invited by, hashed token, expiry, accepted at
- **login_challenges** — pending 2FA email codes: hashed code, expiry (5 min), attempts, used at
- **sms_otps** — hashed phone + hashed 6-digit code, purpose (sign-in/activate/PIN reset), expiry 5 min, attempts, single use
- **backup_codes** — hashed one-time 2FA backup codes per staff member
- **trusted_devices** — "remember this device" (hashed device token, expiry)
- **verified_sessions** — sessions that completed full sign-in (password + code)
- **password_history** — hashes of the last 5 passwords
- **rate_limits** — counters per account, phone and IP, with lockout-until
- **sms_log** — provider message ID, status, retries, purpose; never the message body
- **audit_logs** — who, role, facility, action, record type/ID, when, IP, device; append-only (no edit or delete, even for system admin)
- **app_settings** — system configuration flags

## Server actions (phase 1)

Public (rate-limited, never reveal whether an account exists):
- `bootstrapSystemAdmin` (only while no system admin exists)
- `staffLoginStart`, `staffLoginVerifyCode`, `staffLoginUseBackupCode`, `resendStaffCode`
- `requestPhoneOtp`, `verifyPhoneOtp` (mothers, guardians, CHVs; activation uses the same)
- `requestPasswordReset`, `completePasswordReset` (30-minute single-use link)
- `acceptInvite`

Signed-in:
- `getMe` (profile, roles, facility → decides which portal)
- `changePassword`, `signOutEverywhere`
- System admin: `listFacilities`, `createFacility`, `updateFacility`, `setFacilityActive`, `inviteHospitalAdmin`, `listAuditLogs`, `getSettings`, `updateSetting`
- Hospital admin: `listStaff`, `inviteStaff`, `changeStaffRole`, `deactivateStaff`, `reactivateStaff`, `issueTemporaryPassword`, `facilityAuditLog`

## Security rules built in

- All permission checks run on the server and in the database, not just in the screens.
- A password alone never gives access: data access requires a session that passed the email code step, so calling the backend directly cannot skip 2FA.
- Deactivating staff ends their sessions immediately.
- Password reset or change ends all other sessions, sends a "your password was changed" notice, and is audit-logged.
- Same generic failure message everywhere: "Those details don't match. Please try again." Lockout message: "try again in 15 minutes."
- Idle timeout: shorter for staff (15 min) than mothers (30 min).
- Audit entries for every sign-in, failed sign-in, reset request, password change, invite, role change and deactivation. No passwords, tokens or SMS bodies in logs.

## What I will need from you after you approve

- Africa's Talking username, API key and (optional) sender ID — entered in a secure form.
- An email domain you own (for branded reset emails and 2FA codes). Until it's verified, staff 2FA codes cannot be delivered.

## Tests in phase 1

Password rules, generic error messages, reset link and code expiry (5 min / 30 min), rate-limit lockout, role permissions (e.g. hospital admin cannot manage another hospital's staff; non-admins cannot invite), audit log cannot be edited or deleted.

## Technical details

- Phone and staff-ID sign-ins resolve to an internal auth identity server-side; after the code step the server issues the session, and that session's ID is written to `verified_sessions`. Row-level security policies require `is_session_verified()` plus role checks via a security-definer `has_role()` function.
- Codes and tokens: random, hashed (SHA-256 with server secret), single-use; passwords hashed by the auth service; password history uses bcrypt.
- Records are tagged with `facility_id` everywhere, ready for the shared multi-hospital timeline in phase 8.
- The master prompt is saved in the project at `docs/MASTER_PROMPT.md`.
