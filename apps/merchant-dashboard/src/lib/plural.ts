import { getIntlLocale } from "@/i18n/LocaleContext";

/**
 * Picks the wording for a count in the active language. Arabic has six
 * plural forms (zero, one, two, few = 3–10, many = 11–99, other); English
 * two. Forms that are missing fall back to `other`, so an English message
 * only needs `one` and `other`. `{n}` in the chosen form is replaced by the
 * count with the language's digits.
 *
 *   plural(3, { one: "أوردر واحد", two: "أوردرين", few: "{n} أوردرات", other: "{n} أوردر" })
 *   → "٣ أوردرات"
 */
export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & { other: string };

export function plural(count: number, forms: PluralForms): string {
  const locale = getIntlLocale();
  let rule: Intl.LDMLPluralRule = "other";
  try {
    rule = new Intl.PluralRules(locale).select(count);
  } catch {
    /* an engine without PluralRules: the general form */
  }
  const text = forms[rule] ?? forms.other;
  return text.replace("{n}", new Intl.NumberFormat(locale).format(count));
}

/**
 * The same, with the forms kept as ordinary `useT` strings named
 * `<base>_one`, `<base>_two`, `<base>_few`, `<base>_many`, `<base>_other`.
 * A language only lists the forms it needs; `<base>_other` is required.
 */
export function pluralOf(strings: object, base: string, count: number): string {
  const table = strings as Record<string, string | undefined>;
  const forms: PluralForms = { other: table[`${base}_other`] ?? "{n}" };
  for (const rule of ["zero", "one", "two", "few", "many"] as const) {
    const text = table[`${base}_${rule}`];
    if (text !== undefined) forms[rule] = text;
  }
  return plural(count, forms);
}

/**
 * The everyday counted words, written once so every screen says them the same
 * way: «دقيقة واحدة / دقيقتين / ٥ دقايق / ١١ دقيقة», «أوردر واحد / أوردرين /
 * ٣ أوردرات / ١١ أوردر» (re-audit N-10). Put the result into a template as a
 * whole word group: `fmt("باقي {left}", { left: countOf("minute", n) })`.
 */
const UNITS = {
  minute: {
    en: { one: "1 minute", other: "{n} minutes" },
    ar: { one: "دقيقة واحدة", two: "دقيقتان", few: "{n} دقائق", other: "{n} دقيقة" },
  },
  hour: {
    en: { one: "1 hour", other: "{n} hours" },
    ar: { one: "ساعة واحدة", two: "ساعتان", few: "{n} ساعات", other: "{n} ساعة" },
  },
  day: {
    en: { one: "1 day", other: "{n} days" },
    ar: { one: "يوم واحد", two: "يومان", few: "{n} أيام", other: "{n} يوم" },
  },
  order: {
    en: { one: "1 order", other: "{n} orders" },
    ar: { one: "طلب واحد", two: "طلبان", few: "{n} طلبات", other: "{n} طلبًا" },
  },
  item: {
    en: { one: "1 item", other: "{n} items" },
    ar: { one: "منتج واحد", two: "منتجان", few: "{n} منتجات", other: "{n} منتج" },
  },
  call: {
    en: { one: "1 call", other: "{n} calls" },
    ar: { one: "مكالمة واحدة", two: "مكالمتان", few: "{n} مكالمات", other: "{n} مكالمة" },
  },
  piece: {
    en: { one: "1 piece", other: "{n} pieces" },
    ar: { one: "قطعة واحدة", two: "قطعتان", few: "{n} قطع", other: "{n} قطعة" },
  },
} satisfies Record<string, { en: PluralForms; ar: PluralForms }>;

export type CountUnit = keyof typeof UNITS;

export function countOf(unit: CountUnit, count: number): string {
  const language = getIntlLocale().toLowerCase().startsWith("ar") ? "ar" : "en";
  return plural(count, UNITS[unit][language]);
}
