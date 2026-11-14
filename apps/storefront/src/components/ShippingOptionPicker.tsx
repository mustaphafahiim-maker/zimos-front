"use client";

import { useStore } from "@/lib/StoreContext";
import type { ShippingChoice } from "@/lib/shippingChoice";

const STRINGS = {
  en: { title: "Delivery", free: "Free", days: "{min}–{max} days", day: "{n} day(s)", standard: "Standard delivery" },
  ar: { title: "طريقة التوصيل", free: "مجانًا", days: "من {min} إلى {max} أيام", day: "{n} يوم", standard: "توصيل عادي" },
};

const fill = (text: string, values: Record<string, number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));

/** The store's shipping options as radio cards (nothing when there is no choice). */
export function ShippingOptionPicker({ choice, idPrefix }: { choice: ShippingChoice; idPrefix: string }) {
  const { money, intlLocale } = useStore();
  if (choice.options.length < 2) return null;
  const t = intlLocale.startsWith("ar") ? STRINGS.ar : STRINGS.en;
  const ar = intlLocale.startsWith("ar");

  return (
    <fieldset className="mt-4 space-y-2">
      <legend className="mb-1 text-sm font-semibold text-ink">{t.title}</legend>
      {choice.options.map((o) => {
        const name = (ar ? o.nameAr || o.nameEn : o.nameEn || o.nameAr) || (o.key === "standard" ? t.standard : o.key);
        const eta =
          o.daysMin !== null && o.daysMax !== null && o.daysMax !== o.daysMin
            ? fill(t.days, { min: o.daysMin, max: o.daysMax })
            : o.daysMax !== null || o.daysMin !== null
              ? fill(t.day, { n: (o.daysMax ?? o.daysMin) as number })
              : null;
        const id = `${idPrefix}-ship-${o.key}`;
        return (
          <label
            key={o.key}
            htmlFor={id}
            className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-paper px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
          >
            <span className="flex items-center gap-2">
              <input id={id} type="radio" name={`${idPrefix}-shipping-option`} checked={choice.value === o.key} onChange={() => choice.choose(o.key)} />
              <span>
                <span className="font-medium text-ink">{name}</span>
                {eta && <span className="block text-xs text-ink-soft">{eta}</span>}
              </span>
            </span>
            <span className="shrink-0 font-semibold text-ink">{o.amount > 0 ? money(o.amount) : t.free}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
