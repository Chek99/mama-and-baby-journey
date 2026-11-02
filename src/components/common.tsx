import { useState, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Globe, Loader2, WifiOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n, type Lang } from "@/lib/i18n";
import { useOnline } from "@/hooks/use-online";

export function LanguageSwitch({ onChange }: { onChange?: ((l: Lang) => void) | undefined }) {
  const { lang, setLang, t } = useI18n();
  const choose = (l: Lang) => {
    setLang(l);
    onChange?.(l);
  };
  return (
    <div role="group" aria-label={t("common.language")} className="flex items-center gap-1 rounded-full bg-card/80 p-1 shadow-soft">
      <Globe className="ml-2 size-4 text-muted-foreground" aria-hidden="true" />
      {(["en", "sw"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => choose(l)}
          aria-pressed={lang === l}
          className={cn(
            "min-h-9 rounded-full px-3 text-sm font-bold transition-colors",
            lang === l ? "bg-role text-role-foreground" : "text-foreground hover:bg-muted",
          )}
        >
          {l === "en" ? "English" : "Kiswahili"}
        </button>
      ))}
    </div>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-warning-soft px-4 py-2 text-sm font-semibold text-warning-ink">
      <WifiOff className="size-4" aria-hidden="true" />
      {t("common.offline")}
    </div>
  );
}

export function FormMessage({ tone = "error", children, id }: { tone?: "error" | "success" | "info"; children: ReactNode; id?: string }) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  return (
    <div
      id={id}
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold",
        tone === "error" && "bg-error-soft text-destructive",
        tone === "success" && "bg-success-soft text-success",
        tone === "info" && "bg-role-soft text-role-ink",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
      {children}
    </p>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin", className)} aria-hidden="true" />;
}

export function PasswordInput(
  props: Omit<ComponentProps<typeof Input>, "type"> & { id: string },
) {
  const [show, setShow] = useState(false);
  const { t } = useI18n();
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className={cn("pr-12", props.className)} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-muted-foreground hover:text-foreground"
        aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
        aria-controls={props.id}
      >
        {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export function StepIndicator({ step, total = 3, label }: { step: number; total?: number; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <div className="flex gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn("h-2 flex-1 rounded-full", i < step ? "bg-role" : "bg-muted")} />
        ))}
      </div>
    </div>
  );
}
