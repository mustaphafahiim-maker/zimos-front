import { Languages } from "lucide-react";
import { cn } from "@store-builder/ui";
import { useLocale, useT } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { switchTo: "Switch to Arabic" },
  ar: { switchTo: "التبديل إلى الإنجليزية" },
};

/**
 * "عربي" / "EN" toggle — shows the language you would switch *to*.
 * Styled to match <ThemeToggle />: a bordered pill on the raised surface.
 */
export function LanguageSwitch({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
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
        "cursor-pointer inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-line bg-paper-raised text-sm font-medium text-ink-soft transition-colors hover:border-ink-soft hover:text-ink",
        compact ? "w-9" : "px-3",
        className
      )}
    >
      {!compact && <Languages className="size-4" aria-hidden />}
      <span lang={locale === "ar" ? "en" : "ar"}>{target}</span>
    </button>
  );
}
