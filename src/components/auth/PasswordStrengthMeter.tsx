import { Check, Circle, X } from "lucide-react";
import { checkPassword, passwordStrength } from "@/lib/password-rules";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Live strength bar (red/amber/green, always with a word) and rule checklist. */
export function PasswordStrengthMeter({ password, email }: { password: string; email?: string | null | undefined }) {
  const { t } = useI18n();
  const strength = passwordStrength(password, { email: email ?? null });
  const checks = checkPassword(password, { email: email ?? null });
  const filled = strength === "strong" ? 3 : strength === "fair" ? 2 : strength === "weak" ? 1 : 0;
  const color = strength === "strong" ? "bg-success" : strength === "fair" ? "bg-warning" : "bg-destructive";

  const items: { ok: boolean | null; label: string }[] = [
    { ok: password ? checks.minLength : null, label: t("reset.rule.length") },
    { ok: password ? checks.lettersAndNumbers : null, label: t("reset.rule.mix") },
    { ok: password ? checks.notCommon : null, label: t("reset.rule.common") },
    { ok: null, label: t("reset.rule.history") },
  ];

  return (
    <div className="space-y-3 rounded-xl bg-muted/60 p-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={cn("h-2 flex-1 rounded-full", i < filled ? color : "bg-border")} />
          ))}
        </div>
        <span className="min-w-16 text-right text-sm font-bold">
          {t("reset.strength")}: {t(`reset.strength.${strength}`)}
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2">
            {it.ok === true ? (
              <Check className="size-4 text-success" aria-label="✓" />
            ) : it.ok === false ? (
              <X className="size-4 text-destructive" aria-label="✗" />
            ) : (
              <Circle className="size-3.5 text-muted-foreground" aria-hidden="true" />
            )}
            <span className={cn(it.ok === true && "text-success", it.ok === false && "text-destructive")}>{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
