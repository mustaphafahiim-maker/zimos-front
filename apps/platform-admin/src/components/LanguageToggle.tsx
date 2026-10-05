import { useLocale, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "@/lib/shellStrings";

/** Arabic / English, next to the theme toggle: flips the page direction and is remembered. */
export function LanguageToggle() {
  const { toggleLocale } = useLocale();
  const t = useT(SHELL_STRINGS);
  return (
    <button
      type="button"
      onClick={toggleLocale}
      aria-label={t.switchLanguage}
      title={t.switchLanguage}
      className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-sm font-semibold text-ink-soft hover:bg-primary-soft hover:text-ink"
    >
      {t.languageShort}
    </button>
  );
}
