# Backend API contract

This app is frontend-only. Every call goes through `src/lib/api/` to the backend
whose base address is set in the `VITE_API_URL` environment variable
(e.g. `https://api.example.co.ke`, no trailing slash). Until it is set, the app
shows a yellow "backend address is not set" bar and sign-in cannot work.

## General rules

- JSON in, JSON out. `GET` inputs are sent as query-string parameters; `POST` inputs as a JSON body.
- **CORS:** allow the app's origins (preview + published domains), methods `GET, POST`, headers `content-type, authorization`.
- **Auth:** signed-in calls send `Authorization: Bearer <access_token>`. Return `401` when the token is missing/expired.
  The app then calls `POST /auth/refresh` once and retries; if that fails it signs the user out.
- **Business failures** (wrong password, expired code, ...) return `200` with `{ "ok": false, "error": "<code>" }`.
  Non-2xx statuses are for auth (`401`), permission (`403`) and server errors. Optional error body: `{ "error": "<code>" }`.
- **Never reveal whether an account exists.** Wrong identifier and wrong password both return `error: "generic"`.
  Phone-code and reset requests return `{ ok: true }` even for unknown numbers/emails.
- **Every rule must be enforced server-side** — the frontend's checks are only for display.
  In particular: only Doctor/Nurse (role `clinician`) may record a vaccine as given; hospital admins act only within their own facility.
- **SMS text must be generic**: never results, diagnoses, HIV status or the word "HIV". Templates the app expects are in `src/lib/sms-templates.ts`.

Public error codes (`PublicAuthError`): `generic`, `locked`, `expired`, `sms_unavailable`, `weak_password`, `reused_password`.
Timings the UI assumes (`src/lib/auth-rules.ts`): codes valid 5 min, reset link 30 min, resend cooldown 60 s,
5 code attempts, 15-minute lockout, "remember this device" 30 days. Password rules: `src/lib/password-rules.ts`.

Session object returned on successful sign-in:

```json
{ "access_token": "…", "refresh_token": "…" }
```

`portal` is one of `/admin`, `/facility`, `/clinician`, `/chv`, `/mother` (from roles: system_admin → hospital_admin → clinician → chv → mother).

## Endpoints

### Setup (no auth)
| Method | Path | Input | Reply |
|---|---|---|---|
| GET | `/setup/status` | – | `{ needsSetup: boolean }` (true while no system admin exists) |
| POST | `/setup/system-admin` | `{ fullName, email, password }` | `{ ok: true }` or `{ ok: false, error: "closed" \| "weak_password" \| "locked" \| "generic" }` |

### Health worker sign-in (no auth) — password, then 6-digit email code
| Method | Path | Input | Reply |
|---|---|---|---|
| POST | `/auth/staff/start` | `{ identifier (email or staff ID), password, rememberDevice, deviceToken? }` | `{ ok: true, step: "code", challengeId, maskedEmail }` — or, if `deviceToken` is a valid remembered device, `{ ok: true, step: "done", session, portal, mustChangePassword }` — or Fail |
| POST | `/auth/staff/verify-code` | `{ challengeId, code }` | SignedIn or Fail |
| POST | `/auth/staff/backup-code` | `{ challengeId, backupCode }` | SignedIn or Fail |
| POST | `/auth/staff/resend-code` | `{ challengeId }` | `{ ok: true }` or Fail |
| POST | `/auth/staff/confirm-link` | `{ challengeId, token }` | SignedIn or Fail |

SignedIn = `{ ok: true, session, portal, mustChangePassword, deviceToken? }`. Return `deviceToken` when the user ticked "remember this device".
The code email may also contain a one-click link: `<app>/verify-sign-in?c=<challengeId>&t=<linkToken>`.

### Mothers, guardians, CHVs (no auth) — phone + SMS code (Africa's Talking)
| Method | Path | Input | Reply |
|---|---|---|---|
| POST | `/auth/phone/request-code` | `{ phone (+2547…), purpose: "sign_in" \| "activate", language: "en" \| "sw" }` | `{ ok: true }` or Fail (`sms_unavailable`, `locked`) |
| POST | `/auth/phone/verify-code` | `{ phone, code }` | `{ ok: true, session, portal }` or Fail |

### Password reset (no auth)
| Method | Path | Input | Reply |
|---|---|---|---|
| POST | `/auth/password-reset/request` | `{ identifier }` | `{ ok: true }` (always) or Fail (`locked`) |
| POST | `/auth/password-reset/complete` | `{ token, password }` | `{ ok: true }` or Fail (`expired`, `weak_password`, `reused_password`) |

The reset email links to `<app>/reset-password?token=<resetToken>`.

### Session
| Method | Path | Input | Reply |
|---|---|---|---|
| POST | `/auth/refresh` | `{ refresh_token }` (no bearer) | `{ access_token, refresh_token }` or `401` |
| POST | `/auth/sign-out` | – | `{ ok: true }` |

### Signed-in account (bearer required)
| Method | Path | Input | Reply |
|---|---|---|---|
| GET | `/me` | – | MeDto (below) |
| POST | `/me/password` | `{ currentPassword?, newPassword }` | `{ ok: true }` or Fail. `currentPassword` is omitted only when `mustChangePassword` is true. |
| POST | `/me/sign-out-everywhere` | – | `{ ok: true }` |
| GET | `/me/backup-codes` | – | `{ remaining: number }` |
| POST | `/me/backup-codes` | – | `{ codes: string[] }` (replaces old ones, shown once) |
| POST | `/me/language` | `{ language: "en" \| "sw" }` | `{ ok: true }` |

MeDto:
```ts
{ verified: boolean; userId: string; fullName: string; email: string | null; phone: string | null;
  staffId: string | null; language: "en" | "sw";
  roles: ("system_admin" | "hospital_admin" | "clinician" | "chv" | "mother")[];
  portal: string; mustChangePassword: boolean; usesPassword: boolean;
  facility: { id: string; name: string; isActive: boolean } | null; idleMinutes: number }
```
`verified: false` makes the app drop the session (use it for a half-finished 2FA).

### System admin (role `system_admin`)
| Method | Path | Input | Reply |
|---|---|---|---|
| GET | `/admin/facilities` | – | FacilityDto[] |
| POST | `/admin/facilities` | `{ id?, name, mflCode?, county, subCounty?, ward?, phone?, email?, address?, services? }` (id = update) | `{ ok: true, id }` or `{ ok: false, error: "mfl_taken" \| "generic" }` |
| POST | `/admin/facilities/active` | `{ id, active }` | `{ ok: true }` |
| GET | `/admin/audit-logs` | `before?` (id), `action?` | `{ rows: AuditDto[], hasMore }` |
| GET | `/admin/settings` | – | `{ key, value, description, updatedAt }[]` |
| POST | `/admin/settings` | `{ key, value }` | `{ ok: true }` |

Settings keys: `mother_can_view_full_schedule` (boolean, default false), `staff_idle_timeout_minutes` (5–120, default 15), `mother_idle_timeout_minutes` (5–240, default 30).

FacilityDto: `{ id, name, mflCode, county, subCounty, ward, phone, email, address, services: string[], isActive }`.
AuditDto: `{ id: number, at, action, actorName, actorRole, facilityName, entityType, success, ip, device }`.

### Staff (system admin manages hospital admins; hospital admin manages own facility)
| Method | Path | Input | Reply |
|---|---|---|---|
| GET | `/staff` | `scope=facility \| hospital_admins` | StaffDto[] |
| POST | `/staff` | `{ role: "hospital_admin" \| "clinician" \| "chv", facilityId? (system admin only), fullName, email?, phone?, staffId?, licenceNumber?, cadre?, ward? }` | `{ ok: true, tempPassword? }` or `{ ok: false, error: "taken" \| "forbidden" \| "generic" }` |
| POST | `/staff/role` | `{ userId, role: "hospital_admin" \| "clinician" }` | `{ ok: true }` or `{ ok: false, error: "forbidden" }` |
| POST | `/staff/active` | `{ userId, active }` | `{ ok: true }` |
| POST | `/staff/temporary-password` | `{ userId }` | `{ ok: true, tempPassword }` or `{ ok: false, error }` |

CHVs need a phone and sign in by SMS (no temp password). Other staff need an email and get a temporary password that must be changed on first sign-in.
StaffDto: `{ userId, fullName, email, phone, staffId, licenceNumber, cadre, role, ward, facilityId, facilityName, isActive, mustChangePassword, createdAt }`.
