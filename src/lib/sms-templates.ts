/**
 * SMS wording (spec section 6 privacy rules).
 * Messages must stay generic: no test results, diagnoses, HIV status or the
 * word "HIV". Every template is checked by a unit test.
 */

export type SmsLanguage = "en" | "sw";

export const SMS_APP_NAME = "Mama na Mtoto";

export function otpSms(code: string, lang: SmsLanguage): string {
  return lang === "sw"
    ? `${SMS_APP_NAME}: nambari yako ya kuingia ni ${code}. Inaisha baada ya dakika 5. Usimpe mtu yeyote.`
    : `${SMS_APP_NAME}: your sign-in code is ${code}. It expires in 5 minutes. Do not share it.`;
}

export function passwordChangedSms(lang: SmsLanguage): string {
  return lang === "sw"
    ? `${SMS_APP_NAME}: nenosiri lako limebadilishwa. Kama si wewe, wasiliana na msimamizi wa kituo chako mara moja.`
    : `${SMS_APP_NAME}: your password was changed. If this was not you, contact your facility admin straight away.`;
}

/** Words that must never appear in any SMS. */
export const FORBIDDEN_SMS_WORDS = [/\bhiv\b/i, /\baids\b/i, /\bpositive\b/i, /\bnegative\b/i, /\bsyphilis\b/i, /\bresult/i, /\bdiagnos/i];

export function isSmsTextSafe(text: string): boolean {
  return !FORBIDDEN_SMS_WORDS.some((re) => re.test(text));
}
