import { useState } from "react";
import { Button } from "@store-builder/ui";
import type { OrderEmailLocaleTemplate } from "@store-builder/api-client";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { FilterTabs } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";

/**
 * Order emails per language (handoff 383): the row of language tabs over the
 * list, the badge that says how an email goes out in a language that is not
 * the store's own, and — in the editor — the note about the shared on/off
 * switch with the button that removes a language's version.
 */
export const ORDER_EMAIL_LANGUAGE_STRINGS = {
  en: {
    tabsLabel: "Email language",
    lang_ar: "Arabic",
    lang_en: "English",
    lang_fr: "Français",
    defaultMark: "{language} · Default",
    translated: "Translated",
    sentInDefault: "Sent in the default language",
    sentInBuiltIn: "Sent in the built-in text",
    editingNote: "You are writing the {language} version: customers who shop in {language} get it.",
    switchNote: "On/off applies to every language",
    remove: "Remove the {language} version",
    removeTitle: "Remove the {language} version?",
    removeBody: "Customers shopping in {language} will get the default version",
    removed: "The {language} version was removed.",
    cancel: "Cancel",
  },
  ar: {
    tabsLabel: "لغة الإيميل",
    lang_ar: "العربية",
    lang_en: "English",
    lang_fr: "Français",
    defaultMark: "{language} · الافتراضية",
    translated: "مترجمة",
    sentInDefault: "بتتبعت باللغة الافتراضية",
    sentInBuiltIn: "بتتبعت بالنص الجاهز",
    editingNote: "إنت بتكتب نسخة {language}: العملاء اللي بيتسوقوا بالـ{language} هيستلموها.",
    switchNote: "التشغيل والإيقاف لكل اللغات",
    remove: "حذف ترجمة {language}",
    removeTitle: "تحذف ترجمة {language}؟",
    removeBody: "العملاء اللي بيتسوقوا بالـ{language} هيستلموا النسخة الافتراضية",
    removed: "ترجمة {language} اتحذفت.",
    cancel: "إلغاء",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof ORDER_EMAIL_LANGUAGE_STRINGS)["en"], string>;

/** A language's name as the tabs show it; a language this file has no word for shows its own name, else its code. */
export function orderEmailLanguageName(t: Strings, code: string): string {
  const own = (t as Record<string, string | undefined>)[`lang_${code}`];
  if (own) return own;
  try {
    return new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Arabic and the other right-to-left languages a store may offer. */
export const orderEmailTextDir = (code: string | null | undefined): "rtl" | "ltr" => (code && ["ar", "fa", "ur", "he"].includes(code) ? "rtl" : "ltr");

/**
 * The tabs over the list, one per language of the store, the store's own
 * first and marked «الافتراضية». Shown only for a store with more than one
 * language. `value` null = the store's own.
 */
export function OrderEmailLanguageTabs({
  languages,
  defaultLocale,
  value,
  onChange,
}: {
  languages: string[];
  defaultLocale: string;
  value: string | null;
  onChange: (locale: string | null) => void;
}) {
  const t = useT(ORDER_EMAIL_LANGUAGE_STRINGS) as Strings;
  if (languages.length <= 1) return null;
  const ordered = [defaultLocale, ...languages.filter((code) => code !== defaultLocale)];
  return (
    <div className="mb-3 max-w-full overflow-x-auto">
      <FilterTabs
        label={t.tabsLabel}
        value={value ?? defaultLocale}
        onChange={(code) => onChange(code === defaultLocale ? null : code)}
        buttonClassName="min-h-11 whitespace-nowrap md:min-h-0"
        tabs={ordered.map((code) => ({
          value: code,
          label: code === defaultLocale ? fmt(t.defaultMark, { language: orderEmailLanguageName(t, code) }) : orderEmailLanguageName(t, code),
        }))}
      />
    </div>
  );
}

/** In a language tab that is not the store's own: «مترجمة», or how the email goes out while there is no version yet. */
export function OrderEmailVersionBadge({ template, defaultLocale }: { template: OrderEmailLocaleTemplate; defaultLocale: string }) {
  const t = useT(ORDER_EMAIL_LANGUAGE_STRINGS) as Strings;
  if (template.version === "language") return <StatusBadge value="language" tone="success" text={t.translated} />;
  if (template.version === "fallback") {
    return <StatusBadge value="fallback" tone="neutral" text={template.textLocale === defaultLocale ? t.sentInDefault : t.sentInBuiltIn} className="whitespace-normal text-start" />;
  }
  return null;
}

/**
 * What the editor starts from in a language tab: the language's own version,
 * or — while it has none — the built-in text in that language (`defaults`),
 * as plain text.
 */
export function orderEmailLanguageDraft<T extends OrderEmailLocaleTemplate>(template: T): T {
  if (template.version !== "fallback") return template;
  return { ...template, subject: template.defaults.subject, body: template.defaults.body, blocks: null };
}

/**
 * Above the editor's form in a language tab: which version is being written,
 * that the on/off switch is one for every language, and «حذف ترجمة {language}»
 * when this language has a version of its own.
 */
export function OrderEmailLanguageNote({
  language,
  canRemove,
  onRemove,
}: {
  language: string;
  canRemove: boolean;
  /** Resolves once the version is removed; throws to show why it was not. */
  onRemove: () => Promise<void>;
}) {
  const t = useT(ORDER_EMAIL_LANGUAGE_STRINGS) as Strings;
  const errorMessage = useErrorMessage();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const name = orderEmailLanguageName(t, language);

  async function remove() {
    setBusy(true);
    setFailure(null);
    try {
      await onRemove();
    } catch (err) {
      setFailure(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[var(--radius)] bg-primary-soft px-3 py-2 text-xs leading-5 text-primary-dark" data-email-language={language}>
      <p>{fmt(t.editingNote, { language: name })}</p>
      <p>{t.switchNote}</p>
      {canRemove && !asking && (
        <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11 text-danger hover:text-danger md:min-h-9" onClick={() => setAsking(true)}>
          {fmt(t.remove, { language: name })}
        </Button>
      )}
      {/* Asked here rather than in a dialog: the editor is itself one. */}
      {canRemove && asking && (
        <div role="group" aria-label={fmt(t.removeTitle, { language: name })} className="mt-2 space-y-2 rounded-[var(--radius)] bg-paper-raised p-3 text-ink">
          <p className="text-sm font-medium">{fmt(t.removeTitle, { language: name })}</p>
          <p className="text-sm text-ink-soft">{fmt(t.removeBody, { language: name })}</p>
          {failure && (
            <p role="alert" className="text-sm font-medium text-danger">
              {failure}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="destructive" size="sm" className="min-h-11 md:min-h-9" disabled={busy} aria-busy={busy} onClick={() => void remove()}>
              {fmt(t.remove, { language: name })}
            </Button>
            <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" disabled={busy} onClick={() => setAsking(false)}>
              {t.cancel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
