import { translationsOverview } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";

/**
 * The language of an order's customer messages (handoff 383): orders remember
 * the language the shopper used the store in, and their emails (and WhatsApp
 * templates) go out in it. Two pieces: the tag on the order page, and the
 * select on the manual order form.
 */
const STRINGS = {
  en: {
    tag: "Language: {language}",
    field: "Customer's message language",
    fieldHint: "The emails and messages about this order go out in it.",
    defaultMark: "{language} (the store's language)",
    notOffered: "This store doesn't offer this language",
    lang_ar: "Arabic",
    lang_en: "English",
    lang_fr: "Français",
  },
  ar: {
    tag: "اللغة: {language}",
    field: "لغة رسائل العميل",
    fieldHint: "إيميلات ورسايل الأوردر ده هتتبعت بيها.",
    defaultMark: "{language} (لغة المتجر)",
    notOffered: "المتجر مش بيدعم اللغة دي",
    lang_ar: "العربية",
    lang_en: "English",
    lang_fr: "Français",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

function languageName(t: Strings, code: string): string {
  const own = (t as Record<string, string | undefined>)[`lang_${code}`];
  if (own) return own;
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * Order page, next to the customer: «اللغة: English» when the order's
 * language is not the store's own. An order from before (`locale` null) and
 * one in the store's language show nothing.
 */
export function OrderLanguageTag({ locale }: { locale: string | null | undefined }) {
  const t = useT(STRINGS) as Strings;
  const { currentWorkspace } = useWorkspace();
  const storeLocale = currentWorkspace?.defaultLocale ?? "ar";
  if (!locale || locale === storeLocale) return null;
  return (
    <span data-order-language={locale} className="inline-flex items-center rounded-full bg-paper-sunken px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-ink-soft">
      {fmt(t.tag, { language: languageName(t, locale) })}
    </span>
  );
}

/**
 * Create order (manual): «لغة رسائل العميل», the store's languages with the
 * store's own first and chosen. Shown only when the store has more than one
 * language — and only to a role that can read them; otherwise the order takes
 * the store's default, as when `locale` is left out. `value` "" = the default.
 */
export function OrderLanguageField({ value, onChange, error }: { value: string; onChange: (locale: string) => void; error?: boolean }) {
  const t = useT(STRINGS) as Strings;
  const workspaceId = useWorkspaceId();
  const overview = useAsync(() => translationsOverview(apiClient, workspaceId).catch(() => null), [workspaceId]);
  const languages = overview.data?.languages ?? [];
  if (languages.length <= 1) return null;
  const defaultLocale = overview.data?.defaultLocale ?? languages.find((language) => language.isDefault)?.locale ?? "ar";
  const others = languages.filter((language) => language.locale !== defaultLocale);
  return (
    <Field label={t.field} hint={t.fieldHint} error={error ? t.notOffered : undefined}>
      {({ id, ...aria }) => (
        <Select id={id} {...aria} name="locale" className="h-11" value={value === defaultLocale ? "" : value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{fmt(t.defaultMark, { language: languageName(t, defaultLocale) })}</option>
          {others.map((language) => (
            <option key={language.locale} value={language.locale}>
              {languageName(t, language.locale)}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}
