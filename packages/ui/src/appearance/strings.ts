/**
 * The words of the look's controls. Each dashboard keeps its own language
 * (its LocaleContext) and passes it in as `locale`, so nothing here reads a
 * context of one app.
 */
export type AppearanceLocale = "en" | "ar";

/** "{n} of 100" + { n: 30 } -> "30 of 100" */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in values ? String(values[key]) : `{${key}}`));
}
