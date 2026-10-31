/**
 * Kenyan phone number helpers.
 * Kenyan mobile numbers are +254 followed by 9 digits starting with 7 or 1
 * (e.g. +254712345678, +254110123456).
 */

/** Returns the number in E.164 form (+2547XXXXXXXX) or null when invalid. */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let local: string;
  if (digits.startsWith("254")) local = digits.slice(3);
  else if (digits.startsWith("0")) local = digits.slice(1);
  else local = digits;
  if (!/^[17]\d{8}$/.test(local)) return null;
  return `+254${local}`;
}

export function isValidKenyanPhone(input: string): boolean {
  return normalizeKenyanPhone(input) !== null;
}

/** Shows only the last 3 digits, e.g. +254 7•• ••• 678. */
export function maskPhone(e164: string): string {
  const last = e164.slice(-3);
  return `+254 ••• ••• ${last}`;
}

/**
 * Internal sign-in identity for phone-only accounts (mothers, guardians, CHVs).
 * Never shown to users and never emailed.
 */
export function phoneIdentityEmail(e164: string): string {
  return `p${e164.replace(/[^\d]/g, "")}@phone.mamanamtoto.invalid`;
}
