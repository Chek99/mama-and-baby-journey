/**
 * Every call the app makes to the external backend. Each function takes
 * `{ data }` and resolves to the reply described in docs/BACKEND_API.md.
 */
import type { AppRole } from "@/lib/permissions";
import { request } from "./http";
import type {
  AddStaffInput,
  AuditDto,
  FacilityDto,
  FacilityInput,
  Fail,
  Json,
  MeDto,
  SessionTokens,
  SettingDto,
  SignedIn,
  StaffDto,
} from "./types";

export * from "./types";
export { ApiError, API_URL, clearSession, getSession, isApiConfigured, setSession } from "./http";

const pub = { auth: false } as const;

// ---- First-run setup -------------------------------------------------------
export const getSetupStatus = () => request<{ needsSetup: boolean }>("GET", "/setup/status", undefined, pub);

export const bootstrapSystemAdmin = ({ data }: { data: { fullName: string; email: string; password: string } }) =>
  request<{ ok: true } | { ok: false; error: "closed" | "weak_password" | "locked" | "generic" }>("POST", "/setup/system-admin", data, pub);

// ---- Health worker sign-in -------------------------------------------------
export const staffLoginStart = ({
  data,
}: {
  data: { identifier: string; password: string; rememberDevice: boolean; deviceToken?: string | undefined };
}) =>
  request<
    | Fail
    | { ok: true; step: "code"; challengeId: string; maskedEmail: string }
    | { ok: true; step: "done"; session: SessionTokens; portal: string; mustChangePassword: boolean }
  >("POST", "/auth/staff/start", data, pub);

export const staffLoginVerifyCode = ({ data }: { data: { challengeId: string; code: string } }) =>
  request<Fail | SignedIn>("POST", "/auth/staff/verify-code", data, pub);

export const staffLoginUseBackupCode = ({ data }: { data: { challengeId: string; backupCode: string } }) =>
  request<Fail | SignedIn>("POST", "/auth/staff/backup-code", data, pub);

export const resendStaffCode = ({ data }: { data: { challengeId: string } }) =>
  request<Fail | { ok: true }>("POST", "/auth/staff/resend-code", data, pub);

export const confirmEmailLinkSignIn = ({ data }: { data: { challengeId: string; token: string } }) =>
  request<Fail | SignedIn>("POST", "/auth/staff/confirm-link", data, pub);

// ---- Mothers, guardians, CHVs: phone + SMS code ----------------------------
export const requestPhoneCode = ({ data }: { data: { phone: string; purpose: "sign_in" | "activate"; language: "en" | "sw" } }) =>
  request<Fail | { ok: true }>("POST", "/auth/phone/request-code", data, pub);

export const verifyPhoneCode = ({ data }: { data: { phone: string; code: string } }) =>
  request<Fail | { ok: true; session: SessionTokens; portal: string }>("POST", "/auth/phone/verify-code", data, pub);

// ---- Password reset ----------------------------------------------------------
export const requestPasswordReset = ({ data }: { data: { identifier: string } }) =>
  request<Fail | { ok: true }>("POST", "/auth/password-reset/request", data, pub);

export const completePasswordReset = ({ data }: { data: { token: string; password: string } }) =>
  request<Fail | { ok: true }>("POST", "/auth/password-reset/complete", data, pub);

// ---- Signed-in account -------------------------------------------------------
export const getMe = () => request<MeDto>("GET", "/me");

export const changePassword = ({ data }: { data: { currentPassword?: string | undefined; newPassword: string } }) =>
  request<Fail | { ok: true }>("POST", "/me/password", data);

export const signOutEverywhere = () => request<{ ok: true }>("POST", "/me/sign-out-everywhere");

export const recordSignOut = () => request<{ ok: true }>("POST", "/auth/sign-out");

export const backupCodeStatus = () => request<{ remaining: number }>("GET", "/me/backup-codes");

export const generateBackupCodes = () => request<{ codes: string[] }>("POST", "/me/backup-codes");

export const setMyLanguage = ({ data }: { data: { language: "en" | "sw" } }) => request<{ ok: true }>("POST", "/me/language", data);

// ---- System admin --------------------------------------------------------------
export const listFacilities = () => request<FacilityDto[]>("GET", "/admin/facilities");

export const saveFacility = ({ data }: { data: FacilityInput }) =>
  request<{ ok: true; id: string } | { ok: false; error: "mfl_taken" | "generic" }>("POST", "/admin/facilities", data);

export const setFacilityActive = ({ data }: { data: { id: string; active: boolean } }) =>
  request<{ ok: true }>("POST", "/admin/facilities/active", data);

export const listAuditLogs = ({ data }: { data: { before?: number | undefined; action?: string | undefined } }) =>
  request<{ rows: AuditDto[]; hasMore: boolean }>("GET", "/admin/audit-logs", data);

export const getSettings = () => request<SettingDto[]>("GET", "/admin/settings");

export const updateSetting = ({ data }: { data: { key: string; value: Json } }) => request<{ ok: true }>("POST", "/admin/settings", data);

// ---- Staff ---------------------------------------------------------------------
export const listStaff = ({ data }: { data: { scope: "facility" | "hospital_admins" } }) => request<StaffDto[]>("GET", "/staff", data);

export const addStaff = ({ data }: { data: AddStaffInput }) =>
  request<{ ok: true; tempPassword?: string | undefined } | { ok: false; error: "taken" | "generic" | "forbidden" }>("POST", "/staff", data);

export const changeStaffRole = ({ data }: { data: { userId: string; role: Extract<AppRole, "hospital_admin" | "clinician"> } }) =>
  request<{ ok: true } | { ok: false; error: "forbidden" }>("POST", "/staff/role", data);

export const setStaffActive = ({ data }: { data: { userId: string; active: boolean } }) => request<{ ok: true }>("POST", "/staff/active", data);

export const issueTemporaryPassword = ({ data }: { data: { userId: string } }) =>
  request<{ ok: true; tempPassword: string } | { ok: false; error: "forbidden" | "generic" }>("POST", "/staff/temporary-password", data);
