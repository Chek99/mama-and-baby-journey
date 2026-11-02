import { HeartHandshake, Stethoscope } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type SignInTab = "staff" | "mother";

/** Two colourful pills: Health Worker (teal) and Mother / Guardian (lavender). */
export function RoleTabs({ value, onChange }: { value: SignInTab; onChange: (v: SignInTab) => void }) {
  const { t } = useI18n();
  const tabs = [
    { id: "staff" as const, label: t("auth.tabStaff"), icon: Stethoscope, on: "bg-teal-soft text-primary ring-primary" },
    { id: "mother" as const, label: t("auth.tabMother"), icon: HeartHandshake, on: "bg-lavender-soft text-lavender-ink ring-lavender-ink" },
  ];
  return (
    <div role="tablist" aria-label={t("common.signIn")} className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1.5">
      {tabs.map(({ id, label, icon: Icon, on }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={selected}
            aria-controls={`panel-${id}`}
            onClick={() => onChange(id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                const next = id === "staff" ? "mother" : "staff";
                onChange(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-sm font-extrabold transition-all sm:text-base",
              selected ? cn("shadow-soft ring-2", on) : "text-muted-foreground hover:bg-card/70",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
