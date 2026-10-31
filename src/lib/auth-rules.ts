/**
 * Shared sign-in timing rules and public error codes (spec 13.2, 13.5).
 * Pure functions so they can be unit-tested and used on client and server.
 */

export const OTP_TTL_MS = 5 * 60 * 1000; // SMS and email codes: 5 minutes
export const RESET_LINK_TTL_MS = 30 * 60 * 1000; // password reset link: 30 minutes
export const RESEND_COOLDOWN_MS = 60 * 1000; // resend timer: 60 seconds
export const MAX_CODE_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;
export const TRUSTED_DEVICE_DAYS = 30;
export const VERIFIED_SESSION_HOURS = 12;

export function isExpired(issuedAt: Date | string | number, ttlMs: number, now: number = Date.now()): boolean {
  return now - new Date(issuedAt).getTime() >= ttlMs;
}

export function secondsUntilResend(lastSentAt: Date | string | number, now: number = Date.now()): number {
  const remaining = RESEND_COOLDOWN_MS - (now - new Date(lastSentAt).getTime());
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

/**
 * Error codes the server may return to sign-in screens. Every reason that
 * would reveal whether an account exists maps to "generic".
 */
export type PublicAuthError = "generic" | "locked" | "expired" | "sms_unavailable" | "weak_password" | "reused_password";

export type InternalAuthFailure =
  | "no_account"
  | "bad_password"
  | "inactive_account"
  | "inactive_facility"
  | "wrong_portal"
  | "bad_code"
  | "too_many_attempts"
  | "locked"
  | "expired"
  | "sms_unavailable";

export function toPublicAuthError(reason: InternalAuthFailure): PublicAuthError {
  switch (reason) {
    case "locked":
    case "too_many_attempts":
      return "locked";
    case "expired":
      return "expired";
    case "sms_unavailable":
      return "sms_unavailable";
    default:
      return "generic";
  }
}

/** Same confirmation whether or not the account exists. */
export const RESET_CONFIRMATION_KEY = "reset.sent" as const;
