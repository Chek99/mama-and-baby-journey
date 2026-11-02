import { describe, expect, it } from "vitest";
import { isExpired, OTP_TTL_MS, secondsUntilResend, toPublicAuthError } from "./auth-rules";
import { isPasswordAcceptable, PASSWORD_MIN_LENGTH } from "./password-rules";
import { isValidKenyanPhone, maskPhone, normalizeKenyanPhone } from "./phone";
import { isSmsTextSafe, otpSms, passwordChangedSms } from "./sms-templates";

describe("password rules", () => {
  it("rejects short and common passwords", () => {
    expect(isPasswordAcceptable("short1A!")).toBe(false);
    expect(isPasswordAcceptable("a".repeat(PASSWORD_MIN_LENGTH - 1))).toBe(false);
  });
  it("accepts a long mixed password", () => {
    expect(isPasswordAcceptable("Mango-River-42-Sunrise")).toBe(true);
  });
  it("rejects a password containing the email name", () => {
    expect(isPasswordAcceptable("janedoe-Password-99", { email: "janedoe@example.com" })).toBe(false);
  });
});

describe("phone numbers", () => {
  it("normalizes common Kenyan formats", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("+254712345678");
    expect(normalizeKenyanPhone("712 345 678")).toBe("+254712345678");
    expect(normalizeKenyanPhone("+254712345678")).toBe("+254712345678");
  });
  it("rejects invalid numbers", () => {
    expect(isValidKenyanPhone("12345")).toBe(false);
    expect(normalizeKenyanPhone("abc")).toBeNull();
  });
  it("masks all but the last digits", () => {
    const masked = maskPhone("+254712345678");
    expect(masked).not.toContain("712345");
    expect(masked.endsWith("678")).toBe(true);
  });
});

describe("codes and errors", () => {
  it("expires codes after the time limit", () => {
    const now = Date.now();
    expect(isExpired(now - OTP_TTL_MS - 1, OTP_TTL_MS, now)).toBe(true);
    expect(isExpired(now - 1000, OTP_TTL_MS, now)).toBe(false);
  });
  it("counts down the resend timer", () => {
    const now = Date.now();
    expect(secondsUntilResend(now - 10_000, now)).toBeGreaterThan(0);
    expect(secondsUntilResend(now - 120_000, now)).toBe(0);
  });
  it("hides why a sign-in failed behind one public error", () => {
    expect(toPublicAuthError("no_account")).toBe("generic");
    expect(toPublicAuthError("bad_password")).toBe("generic");
    expect(toPublicAuthError("bad_code")).toBe("generic");
    expect(toPublicAuthError("inactive_account")).toBe("generic");
  });
  it("tells people when they are locked out", () => {
    expect(toPublicAuthError("too_many_attempts")).toBe("locked");
  });
});

describe("SMS wording", () => {
  it("never mentions sensitive health words", () => {
    expect(isSmsTextSafe(otpSms("123456", "en"))).toBe(true);
    expect(isSmsTextSafe(otpSms("123456", "sw"))).toBe(true);
    expect(isSmsTextSafe(passwordChangedSms("en"))).toBe(true);
    expect(isSmsTextSafe("Your HIV result is ready")).toBe(false);
    expect(isSmsTextSafe("Test came back positive")).toBe(false);
  });
});
