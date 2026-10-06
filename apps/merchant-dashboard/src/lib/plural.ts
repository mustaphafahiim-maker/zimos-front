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
