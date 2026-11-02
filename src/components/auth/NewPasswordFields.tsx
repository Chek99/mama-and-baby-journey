import { FieldError, PasswordInput } from "@/components/common";
import { Label } from "@/components/ui/label";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { useI18n } from "@/lib/i18n";

export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  touched,
  email,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  touched: boolean;
  email?: string | null | undefined;
}) {
  const { t } = useI18n();
  const mismatch = touched && confirm !== password;
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="new-password">{t("reset.newPassword")}</Label>
        <PasswordInput id="new-password" autoComplete="new-password" value={password} onChange={(e) => onPassword(e.target.value)} />
        <PasswordStrengthMeter password={password} email={email} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm-password">{t("reset.confirmPassword")}</Label>
        <PasswordInput
          id="confirm-password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => onConfirm(e.target.value)}
          aria-invalid={mismatch}
          aria-describedby={mismatch ? "confirm-error" : undefined}
        />
        {mismatch && <FieldError id="confirm-error">{t("reset.mismatch")}</FieldError>}
      </div>
    </>
  );
}
