import { Languages } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useLocale, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { switchTo: "Switch to Arabic" },
  ar: { switchTo: "التبديل إلى الإنجليزية" },
};

/** "عربي" / "EN" toggle. Shows the language you would switch *to*. */
export function LanguageSwitch({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { locale, toggleLocale } = useLocale();
  const t = useT(STRINGS);
  const target = locale === "ar" ? "EN" : "عربي";
  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t.switchTo}
      title={t.switchTo}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-[10px] px-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-primary-soft hover:text-primary",
        className
      )}
    >
      {!compact && <Languages className="size-4" aria-hidden />}
      <span lang={locale === "ar" ? "en" : "ar"}>{target}</span>
    </button>
  );
}
