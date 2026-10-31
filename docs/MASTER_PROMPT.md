Master Prompt: Maternal and Child Health Tracking Web App (Kenya)
Corrected version for Meshack, with the fixes from review applied. Sections 1 to 13 are the core spec; sections 14 to 23 are extra features to add only after the core works.
How to use this prompt
• Give the AI sections 1 to 13 first and tell it to start with phase 1 only. Add later sections as you reach those phases, because a very long prompt dilutes attention.
• Keep this file in your project (for example /docs/MASTER_PROMPT.md) so every new session can read it.
1. What we are building
Build a multi-hospital web application that follows a mother from pregnancy registration, through antenatal care and delivery, to the full health record of each child (vaccines, growth, milestones). It replaces the paper mother-baby booklet and clinic cards with one shared digital record that follows the patient between hospitals.
Context: Kenya. Vaccines follow the KEPI schedule. Many clinics have unstable internet and many mothers have only basic phones, so SMS and offline support are essential, not optional.
Build in phases (section 10). Finish and test each phase before starting the next. Ask me before making any decision that changes the data model.
2. Tech stack
• Frontend: React (Vite), Tailwind CSS, Recharts for charts, built as a PWA (service worker, installable, offline-capable).
• Backend: Node.js + Express, REST API, input validation with Zod, JWT auth with refresh tokens, role-based access control middleware.
• Database: PostgreSQL with Prisma ORM and migrations. Use relational design: facilities, users, mothers, pregnancies, visits, deliveries, children, vaccinations, growth records, milestones, reminders, audit logs.
• Background jobs: BullMQ with Redis (or node-cron for the first version) for reminders.
• SMS: Africa's Talking API, behind an interface so providers can be swapped. Push notifications via Firebase later.
• Testing: Vitest/Jest for backend logic (vaccine scheduling and permissions must be well tested), Playwright for key flows.
• Code quality: TypeScript throughout, ESLint, environment variables for all secrets, a README with setup steps, seed data for demo.
3. Roles and permissions
Enforced on the server, never only in the UI.
1. Doctor/Nurse (belongs to one facility): register mothers, record ANC and postnatal visits, record delivery, mark vaccines as given, record growth and milestones, view the full vaccine schedule including upcoming doses, see the defaulters list. For now, doctors and nurses also enter lab results and medicines; separate lab technician or pharmacist roles can be added later.
2. Mother: read-only for clinical records. She sees her pregnancy record and visit history, her children's growth charts and milestones, vaccines already GIVEN, and reminder notifications. She does NOT see the full future vaccine schedule. The only exception is appointment and reminder messages (sections 6 and 14), which may say that a visit or dose is due. She can also add her own self-tracking entries (birth plan, kick counter, symptom diary, messages to the clinic, see section 16) and manage her own consent and sharing settings, but she can never create or edit clinical records. Build the hidden-schedule rule as a configuration flag so showing the full schedule can be switched on later.
3. Community health volunteer (CHV): sees only a defaulters list for their area (name, contact, what is overdue), no clinical details.
4. Hospital admin: manages staff accounts for their facility, sees facility reports.
5. System admin: manages facilities, system settings, and audit logs.
Only Doctor/Nurse roles may create a "vaccine given" record. A mother, CHV or admin must never be able to, even through direct API calls.
4. Mother and pregnancy module
• Registration: full name, national ID (optional), phone, alternative contact / next of kin, village or ward, language preference, consent record.
• Pregnancy: LMP date, system-calculated EDD (LMP + 280 days) and current gestational week, gravida/parity.
• Antenatal care (ANC) visits (WHO 8-contact model). Each visit records: date, facility, gestation, weight, BP, fundal height, fetal heartbeat, fetal movement, urine tests, Hb, HIV and syphilis tests, malaria, ultrasound notes, iron/folate, tetanus (TT) dose, IPTp, next appointment date.
• Risk flags (rule-based, visible to clinicians only): high BP, low Hb, bleeding, reduced fetal movement, age extremes, previous complications. Flagged mothers appear on a clinician "high-risk" list, and a referral can be recorded (referring facility, receiving facility, reason, outcome).
• Delivery record: date and time, facility, mode of delivery, outcome (live birth / stillbirth), number of babies, complications. Delivery is the event; the per-baby birth details in section 15 are fields attached to each baby profile created from it, not a second form built separately.
• Postnatal care (PNC) visits for the mother: day 3, week 6, family planning, postpartum depression screening.
• Pregnancy outcome status: ongoing, delivered, miscarriage, stillbirth, maternal death. Any loss outcome must immediately stop all reminders and baby-related messages for the affected record.
5. Child module
• When a delivery with a live birth is recorded, automatically create one child profile per baby, linked to the mother.
• Twins and multiples: each baby is a separate profile with birth order (Twin A, Twin B, ...) and a "multiple birth" tag. Each has its own vaccines, growth records and milestones. Provide a side-by-side comparison view for siblings born together.
• Child ID: system-generated unique ID plus optional birth notification number. Newborns have no national ID.
• Guardian: store a guardian/caregiver contact separate from the mother (grandmother, father, other), so records work if the mother is unavailable or has died.
• Vaccination (KEPI schedule): BCG, OPV birth dose, OPV 1-3, Pentavalent 1-3, PCV 1-3, Rotavirus 1-2, IPV, Measles-Rubella and later doses. Store the schedule as data (vaccine, dose number, due age, minimum interval, maximum age), not hard-coded, so it can be updated. Each "given" record stores: who gave it, date and time, facility, batch number, expiry date, site. Block expired batches.
• Catch-up logic: if a dose is missed, recalculate the next due date using minimum intervals and maximum ages, not by shifting every date. Allow a deferral or contraindication with a reason.
• Adverse events following immunisation (AEFI): clinician can record a reaction linked to a vaccine record.
• Records are append-only. Corrections are new entries that reference the one they correct. Never delete a vaccine record.
• Growth: weight, length/height, head circumference, MUAC, recorded per visit, plotted against WHO growth standards (weight-for-age, length-for-age, weight-for-length, head circumference) with percentile or z-score curves. Flag faltering growth and malnutrition for the clinician.
• Milestones: configurable list by age (social smile, head control, sitting, crawling, standing, walking, first words, etc.). Clinician records the date achieved or a delay concern.
• Other: Vitamin A, deworming, clinic visit history, HIV-exposed infant follow-up (prophylaxis, early infant diagnosis tests) with extra-restricted visibility.
6. Reminders and notifications
• Daily scheduled job finds ANC visits, PNC visits and child vaccine doses coming due.
• Cadence: 7 days before, 1 day before, and a follow-up after a missed appointment.
• Channels: SMS (primary), in-app notification, push later. Every message is logged with its delivery status, and failed sends are retried.
• Privacy: SMS text must be generic and must never contain test results, HIV status, diagnoses or the word "HIV". Let the mother choose wording style and language (English / Swahili first). Example: "Baby is due for a clinic visit from 12 Nov. Please visit your clinic."
• Stop rules: never send reminders if the pregnancy or child outcome is a loss, or if the contact is marked invalid or opted out.
• Defaulters list: children and mothers with overdue doses/visits, filterable by facility, for the clinician, and a reduced version for CHVs.
• Optional later: USSD or SMS-reply so a mother on a feature phone can check her next appointment.
7. Multi-hospital design
• One central database. Each hospital is a Facility. Every staff account, visit and vaccine record is tagged with its facility, but belongs to one shared timeline per person.
• A mother is one identity across all hospitals (matched by national ID or phone, with duplicate detection and a merge tool that keeps full history).
• Cross-facility access: when staff at Hospital B search for a mother registered at Hospital A, the mother receives an OTP by SMS and must approve before B can see the history. Support an emergency override with a mandatory reason that is flagged for review.
• Every read and write of patient data is written to an audit log: who, what, when, from which facility, and from which device.
• Referral workflow between facilities as described in section 4.
• Facility dashboards: ANC attendance, vaccination coverage, dropout rates, defaulters. Provide an export that matches the immunisation summary forms facilities already submit to the Ministry. Structure data so it can later connect to KHIS/DHIS2 (use FHIR-style resources such as Patient, Immunization, Observation, Encounter where practical).
8. Offline and low-connectivity behaviour
• The clinician interface works offline as a PWA: entries are stored locally (IndexedDB) and synced when connection returns.
• Define conflict rules: records are append-only with timestamps and device/user IDs, so most conflicts reduce to merging, and any real conflict is shown to a clinician to resolve.
• Pages must work on a cheap Android phone and slow networks: small bundles, simple layouts, large touch targets.
9. Security, privacy and compliance
• Kenya's Data Protection Act 2019 applies. Health data is sensitive data.
• Capture and store explicit consent at registration. Encrypt data in transit (HTTPS) and at rest. Hash passwords with bcrypt/argon2. Rate-limit logins and OTPs.
• Two-factor authentication for staff, session timeouts, and a way to deactivate a staff member immediately.
• Minimise data in logs. Never log full patient records or SMS bodies containing personal data.
• Regular automated backups. Provide a data export and a process for correction/erasure requests where legally allowed.
• Include a privacy policy page and consent text (draft for legal review).
10. Build order
Stop and test after each phase.
1. Project setup, database schema, auth, roles, facility and staff management, audit logging.
2. Mother registration, pregnancy, ANC visits, risk flags.
3. Delivery recording, automatic child profiles including twins and multiples, guardian contact, outcome statuses.
4. KEPI schedule as data, vaccine "given" records (doctor/nurse only), catch-up logic, defaulters list.
5. Growth records with WHO charts, milestones, mother-facing dashboard (given vaccines, growth, pregnancy progress).
6. Reminder engine with SMS integration, privacy-safe templates, stop rules.
7. Postnatal care, referrals, AEFI, HIV-exposed infant tracking.
8. Multi-hospital sharing with OTP consent, emergency override, facility dashboards and reports.
9. Offline PWA sync, then USSD and CHV features.
Pilot checkpoint: after phase 6 (or 7), run a pilot at one clinic with real staff and mothers and collect feedback before building further phases.
11. UI guidance
• Two clearly separate portals after login: Clinician portal and Mother portal. Clean, simple screens, mobile-first, English and Swahili.
• Mother portal home: pregnancy progress bar by week (or the child's profile), given vaccines as a progress ring and timeline, growth chart, milestone timeline, reminders.
• Clinician portal home: today's appointments, overdue/defaulters, high-risk mothers, quick search by name, ID or phone.
• Visualisations: WHO growth curves with child points plotted, vaccination timeline, weight and BP trend during pregnancy.
• Printable, QR-coded vaccination certificate per child.
12. How I want you to work
• Start by proposing the database schema (tables, relations, key fields) and the API route list for the current phase, and wait for my approval before writing code.
• Write clean, commented, typed code with tests for vaccine scheduling, permissions and reminder rules.
• Provide seed data (two facilities, sample mothers, a twin birth, an overdue child) so I can demo every role.
• At the end of each phase, give me: what was built, how to run it, how to test it, and what is left.
• If a requirement is unclear or conflicts with another, ask me instead of guessing.
13. Login and password reset: design and behaviour
13.1 Design direction (colourful, warm, trustworthy)
The app is for mothers, babies and health workers, so the look should feel friendly and calm, not like a cold hospital system. Use a bright but soft palette, and keep text contrast high so it stays readable on cheap phones in sunlight.
Colour tokens (define as Tailwind theme colours / CSS variables):
• Primary teal: #0E9F9A (buttons, links, focus rings)
• Coral: #FF6B6B (accent, alerts that need attention, the "forgot password" highlight)
• Sunny yellow: #FFC857 (highlights, illustrations, success sparkle)
• Lavender: #8E7CC3 (secondary accents, mother portal)
• Mint: #DFF5F0 and cream: #FFF8EE (soft backgrounds)
• Deep navy: #1F2A44 (headings and body text)
• Success green #2E9E5B, error red #D64545, warning amber #F2A33A
Use a soft gradient background (mint to cream, with lavender blobs or curved shapes). Support light mode now and keep colours in tokens so dark mode can be added later. All text must meet WCAG AA contrast, and colour must never be the only way an error or status is shown (also use icons and text).
Typography: a rounded, friendly sans-serif such as Nunito or Poppins (with a system-font fallback), large readable sizes (16px minimum body), generous spacing.
Illustration and branding: a simple logo, a friendly illustration (mother and baby, vaccine shield, growing plant) using the palette, as inline SVG so it loads fast on slow networks. Keep images light, because many users are on poor connections.
13.2 Login page layout
• Desktop: two-column card centred on the gradient background. Left: illustration, app name, a one-line tagline, and 3 short benefit icons (Track pregnancy, Never miss a vaccine, Your baby's growth). Right: the login form.
• Mobile: single column, illustration collapsed to a small banner at the top, form below, big touch targets (minimum 48px height).
• Role selector at the top of the form as two colourful tabs/pills: "Health Worker" (teal) and "Mother / Guardian" (lavender). The page accent colour changes with the selected tab.
• Language switch (English / Kiswahili) top right, remembered between visits.
• Offline/connection indicator: a small banner when there is no internet.
Which role uses which login: doctors/nurses, hospital admins and system admins use the Health Worker form. Mothers and guardians use the Mother / Guardian form. Community health volunteers often have no email, so they use the phone number and SMS code form. After login, the app routes every user to the correct portal by role (clinician portal, mother portal, CHV defaulters view, admin screens).
Health Worker form:
• Email or staff ID, password with show/hide eye icon, "Remember this device" checkbox (off by default on shared computers), "Forgot password?" link in coral, and a large teal "Sign in" button with a loading state.
• Facility is determined by the account (do not let the user pick any facility).
• After correct password, show a second step for 2FA: a 6-digit code input with auto-focus, auto-advance, a resend timer, and a "Use backup code" option.
Mother / Guardian form:
• Phone number (Kenya format, +254 prefix pre-filled, validated) and sign in with a one-time code sent by SMS (primary method, no password to remember). Optionally allow a PIN or password set after first login.
• First-time users: "First visit?" link that leads to an activation flow using the phone number the clinic registered, confirmed with an SMS code.
Common to both:
• Inline validation with friendly messages ("Please enter a valid phone number").
• Never say which field was wrong on a failed login. Use one generic message: "Those details don't match. Please try again."
• Loading spinners, disabled buttons while submitting, and clear success and error toasts.
• Footer: privacy policy, terms, help/contact, app version.
13.3 Password reset flow (health workers)
Screens, each in the same colourful card style with a progress indicator (step 1 of 3):
1. "Forgot your password?" Enter email or staff ID, then "Send reset link". Always show the same confirmation whether or not the account exists: "If an account matches, we've sent reset instructions."
2. Email with a single-use reset link that expires in 30 minutes. Branded email template using the same palette. The email must not contain the password or any patient data.
3. "Create a new password" page: new password and confirm fields with show/hide, a live strength meter (red, amber, green) and a checklist (minimum 10 characters, mix of letters and numbers, not a common password, not the same as the last 5). Submit, then show a success screen with a friendly illustration and a "Back to sign in" button.
• After a successful reset: invalidate all existing sessions and refresh tokens, send a "your password was changed" email/SMS, and write an audit log entry.
• Hospital admins can also trigger a reset for a staff member (generates a one-time temporary password that must be changed at first login). The system admin cannot see anyone's password.
13.4 Account recovery for mothers / guardians
• Because they sign in with an SMS code, "recovery" means getting a new code: "Didn't get the code?" with a 60-second resend timer, then an option for "I changed my number" that tells them to visit their clinic, where a health worker verifies identity in person and updates the phone number.
• If they set an optional PIN and forget it, reset it through a new SMS code.
13.5 Security rules for these pages
• Rate-limit login, OTP and reset requests per account, per phone and per IP, with temporary lockout and a friendly "try again in 15 minutes" message.
• Reset tokens and OTPs: random, hashed in the database, single-use, short expiry. OTPs are 6 digits and expire in 5 minutes.
• Hash passwords with argon2 or bcrypt. Enforce HTTPS, secure and httpOnly cookies or short-lived JWT access tokens with rotating refresh tokens, CSRF protection, and an idle session timeout (shorter for clinician screens on shared computers).
• Add CAPTCHA only after repeated failures, and choose a lightweight option so low-end phones are not blocked.
• Log every login, failed login, reset request and password change in the audit log (never log passwords or full tokens).
• Do not reveal whether an email, staff ID or phone number is registered anywhere on these pages.
13.6 Accessibility and low-resource requirements
• Full keyboard navigation, visible focus states, proper labels and ARIA attributes, error messages linked to fields.
• Works on small screens and slow networks: no heavy animation libraries, respect "reduce motion", and keep the login page under a small size budget.
• Subtle, friendly animation only (card fade-in, button press, success tick), nothing that blocks sign-in.
13.7 Deliverables for this part
Build the following as reusable components before wiring the API: LoginPage, RoleTabs, PhoneOtpForm, StaffLoginForm, TwoFactorStep, ForgotPasswordPage, ResetPasswordPage, PasswordStrengthMeter, LanguageSwitch, Toast. Provide a Storybook or a simple demo page so I can review the design before it is connected to the backend, and tests for validation, the generic error messages, and the reset-token expiry.
14. Appointments and clinic workflow
• Appointment booking and scheduling: next-visit dates from ANC, PNC and the vaccine schedule become real appointments with a time slot or a clinic day. Staff can reschedule, and the mother is notified.
• Daily clinic list: who is expected today, with walk-ins added. Mark arrived, in consultation, done, or did not attend (DNA).
• Check-in by QR code: the mother's phone or printed card has a QR code. Staff scan it to open her record in one step.
• Missed-visit tracking: automatic "did not attend" status that feeds the defaulters list and tracing tasks for CHVs.
• Clinician task list: follow-ups due, results to review, high-risk mothers to call.
• Shift handover notes: free-text notes on a patient visible to the next clinician on duty (clinician-only).
15. Extra clinical records
• Birth details for each baby, attached to the baby profile created at delivery (see section 4): birth weight, APGAR scores, gestation at birth, resuscitation, birth defects, cord care, early breastfeeding, Vitamin K and eye prophylaxis.
• Preterm and low birth weight babies: flag them, support kangaroo mother care follow-up, use corrected age for growth and milestone charts.
• Newborn danger signs and jaundice checks at early visits.
• Sick-child visits (outside routine schedule): complaint, diagnosis, treatment, follow-up date, kept separate from preventive visits.
• Medicines and supplements: what was prescribed or dispensed (iron/folate, antimalarials, ARVs where relevant), dose, duration, adherence check at next visit. Entered by doctors/nurses for now.
• Allergies, blood group, chronic conditions: recorded for mother and child, shown as a prominent alert banner to clinicians.
• Lab and test results as structured entries (Hb, glucose, urine, HIV, syphilis, malaria, ultrasound), entered by doctors/nurses for now, with abnormal values highlighted for clinicians.
• Nutrition and breastfeeding: exclusive breastfeeding status to 6 months, complementary feeding start, feeding problems, maternal nutrition and MUAC.
• Mother's own immunisations (TT and others) and family planning method and follow-up.
• Mental health screening for mothers (antenatal and postpartum) with a clinician-only result and a referral path.
• Clinical decision support (simple, rule-based): gestational age and EDD calculator including ultrasound dating, next-dose calculator, growth alerts. These only suggest. The clinician decides.
16. Mother engagement and education (Mother portal)
• Weekly pregnancy tips by gestation week and age-based baby tips (nutrition, sleep, safe sleep, danger signs, hygiene, breastfeeding) in English and Swahili, short and illustrated.
• Birth plan: where she plans to deliver, transport, who will accompany her, emergency contact, items to prepare. Clinician can review it at the 3rd trimester visit.
• Danger-signs checker: simple yes/no questions ("heavy bleeding?", "baby not feeding?") that tell her when to go to a clinic or hospital immediately.
• Celebration moments: friendly badges and messages for completing vaccines or milestones, in keeping with the colourful design. Keep these gentle and never shaming for missed visits.
• Medication and supplement reminders (for example iron tablets daily), if the mother opts in.
• Kick counter and symptom diary: optional self-tracking that clinicians can see.
• Question to the clinic: a short, non-urgent message form answered by staff, with a clear banner that it is not for emergencies.
• Family view: one login shows all her children, with a quick switcher, and carries over to later pregnancies so her record is lifelong.
• Partner/guardian access: the mother can choose to share selected parts with her partner or guardian, with her consent and the ability to revoke it.
17. Emergency and access to care
• Emergency screen: one-tap contact for the facility, ambulance or referral transport numbers, and the nearest facility with a maternity unit.
• Facility finder: list of facilities with services offered (immunisation days, ANC days, maternity), opening days and contact, with a map link.
• Immunisation and clinic days: facilities publish their days, and mothers see them with their reminders.
• Referral letter and summary: one-click printable and shareable summary of the mother or baby's relevant history for the receiving facility.
18. Communication and campaigns
• Bulk messaging for facilities: announcements, clinic day changes, and campaigns (for example catch-up vaccination drives), sent to filtered groups (by ward, child age, overdue status).
• Message templates managed by the admin, with approval for any new wording, and automatic language handling.
• Optional voice (IVR) reminders for mothers who cannot read.
• Staff alerts: high-risk flags, critical lab values and missed referrals notify the responsible clinician.
• Message cost control: monitor SMS credit and usage per facility, with low-balance alerts.
19. Documents, printing and exports
• Digital and printable mother-baby booklet that mirrors the Ministry's paper booklet layout, so facilities can use it for any patient who needs paper.
• Vaccination certificate (with QR verification page that shows only valid/invalid and the child's name, nothing else).
• Referral letter, discharge summary, birth notification form, and immunisation summary report as PDFs.
• Patient data export for the mother (PDF and machine-readable) to support her data-access rights.
20. Administration and operations
• Configuration screens (no code changes): vaccine schedule, ANC schedule, milestone list, risk rules, reminder timings, message templates, facility details and services.
• Bulk import: CSV upload for existing mothers and children from old registers, with validation, duplicate detection and a preview before saving.
• Vaccine stock module (phase later): receive stock by batch, record usage automatically when doses are given, low-stock and near-expiry alerts, wastage record.
• Duplicate management: queue of suspected duplicates for staff to review and merge.
• Staff management: invite staff by email or phone, licence/registration number for clinicians, role changes, deactivation with audit trail.
• Data retention rules and a controlled process for correction or erasure requests, with an approval trail.
• System health: error monitoring, uptime check, background-job failures dashboard, sync status per facility, and backup restore tested regularly.
• Training mode: a sandbox facility with fake data so new staff can practise without touching real records. In-app help, short tutorial walkthroughs and a user guide.
• Feedback channel: a "Report a problem" button and a short satisfaction prompt for both portals.
21. Reports, analytics and integrations
• Facility and county dashboards: ANC attendance and 4+/8 contact coverage, skilled birth attendance, vaccination coverage and dropout (for example Penta1 to Penta3), measles coverage, defaulter rates, high-risk mothers, low birth weight and malnutrition trends. Filter by date, facility and ward.
• Maps and trends: coverage by ward or sub-county, used for planning outreach.
• Scheduled reports: weekly or monthly summaries emailed to hospital admins.
• Integrations to design for (do not build until needed, but keep the data model ready): DHIS2/KHIS reporting, KenyaEMR and other EMRs, the national health records and master facility list, civil registration (birth notification), and insurance details (SHA) for eligibility and billing.
• Open API for approved partners with scoped keys, rate limits and audit logging.
22. Quality and legal
• Automated tests for permissions (especially: only Doctor/Nurse can mark vaccines given), the vaccine scheduler, reminders stop rules, and data merging.
• Accessibility check and a test run on low-end Android devices and slow networks.
• Consent management: consent history per person, withdrawal of consent, and clear notices of who can see what.
• Terms of use and privacy policy drafted for legal review, including the rules for children's data.
• Documentation: architecture overview, API documentation (OpenAPI), database diagram, deployment guide and a runbook for common problems.
23. Updated build order
Keep phases 1 to 9 from section 10, then:
10. Appointments, clinic list, QR check-in and missed-visit tracking (section 14).
11. Extra clinical records: birth details, sick-child visits, medicines, labs, nutrition (section 15).
12. Mother engagement: education tips, birth plan, danger-signs checker, family view (section 16).
13. Emergency features, facility finder, documents and exports (sections 17 and 19).
14. Bulk messaging, configuration screens, bulk import, stock module (sections 18 and 20).
15. Dashboards, scheduled reports and integrations (section 21).
Do not build phases 10 to 15 until the core (phases 1 to 9) is working and has been tested with real clinic users. Run the pilot checkpoint from section 10 first.