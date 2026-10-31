/**
 * Password rules for health worker accounts (spec 13.3).
 * - at least 10 characters
 * - a mix of letters and numbers
 * - not a common password
 * - not the same as the last 5 (checked on the server against stored hashes)
 */

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HISTORY_DEPTH = 5;

// Short list of very common passwords and local patterns. The server also
// checks passwords against a large leaked-password database.
const COMMON_PASSWORDS = new Set(
  [
    "password", "password1", "password12", "password123", "password1234", "passw0rd123",
    "1234567890", "12345678910", "0123456789", "qwertyuiop", "qwerty1234", "qwerty12345",
    "1q2w3e4r5t", "1qaz2wsx3edc", "abc1234567", "abcd123456", "iloveyou12", "welcome123",
    "welcome1234", "letmein123", "admin12345", "administrator1", "changeme123", "monkey12345",
    "football12", "sunshine12", "princess12", "baseball12", "superman12", "trustno1234",
    "asdfghjkl1", "zxcvbnm123", "11111111111", "aaaaaaaaa1", "kenya12345", "kenya123456",
    "nairobi123", "nairobi1234", "mombasa123", "jesus12345", "godisgood1", "hospital123",
    "nurse12345", "doctor1234", "doctor12345", "mama123456", "mtoto12345", "hospital12",
    "clinic1234", "health1234", "health12345", "summer2024", "summer2025", "summer2026",
    "january2026", "october2026", "p@ssw0rd123", "pass123456", "test123456", "user123456",
  ].map((p) => p.toLowerCase()),
);

export interface PasswordChecks {
  minLength: boolean;
  lettersAndNumbers: boolean;
  notCommon: boolean;
}

export function checkPassword(password: string, context?: { email?: string | null }): PasswordChecks {
  const lower = password.toLowerCase();
  const emailLocal = context?.email?.split("@")[0]?.toLowerCase();
  const containsEmail = !!emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal);
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    lettersAndNumbers: /[a-z]/i.test(password) && /\d/.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(lower) && !containsEmail && !/^(.)\1+$/.test(password),
  };
}

export function isPasswordAcceptable(password: string, context?: { email?: string | null }): boolean {
  const c = checkPassword(password, context);
  return c.minLength && c.lettersAndNumbers && c.notCommon;
}

export type PasswordStrength = "empty" | "weak" | "fair" | "strong";

/** Red (weak), amber (fair), green (strong). */
export function passwordStrength(password: string, context?: { email?: string | null }): PasswordStrength {
  if (!password) return "empty";
  const c = checkPassword(password, context);
  if (!c.minLength || !c.lettersAndNumbers || !c.notCommon) return "weak";
  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[^a-z0-9]/i.test(password)) score++;
  return score >= 2 ? "strong" : "fair";
}
