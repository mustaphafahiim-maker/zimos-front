import { useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ThemeToggle } from "@/components/ThemeToggle";

const STRINGS = {
  en: {
    title: "Language and appearance",
    description: "How the dashboard looks on this device. These used to sit in the top bar.",
    language: "Language",
    languageHint: "Arabic or English. The whole dashboard switches at once.",
    theme: "Light or dark",
    themeHint: "Dark is easier on the eyes at night.",
  },
  ar: {
    title: "اللغة والمظهر",
    description: "شكل الداشبورد على هذا الجهاز. كانت هذه الأزرار في الشريط العلوي.",
    language: "اللغة",
    languageHint: "عربي أو إنجليزي. الداشبورد كلها تتحول مرة واحدة.",
    theme: "فاتح أو داكن",
    themeHint: "الوضع الداكن أريح للعين ليلًا.",
  },
} satisfies Messages;

/** The language and theme switches, moved out of the top bar so it stays for search and alerts. */
export function AppearanceSection() {
  const t = useT(STRINGS);
  return (
    <Section title={t.title} description={t.description}>
      <ul className="mt-3 divide-y divide-line">
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{t.language}</p>
            <p className="text-xs text-ink-soft">{t.languageHint}</p>
          </div>
          <LanguageSwitch />
        </li>
        <li className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">{t.theme}</p>
            <p className="text-xs text-ink-soft">{t.themeHint}</p>
          </div>
          <ThemeToggle />
        </li>
      </ul>
    </Section>
  );
}
