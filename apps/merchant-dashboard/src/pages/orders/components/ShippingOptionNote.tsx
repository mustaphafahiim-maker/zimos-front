import type { Order } from "@store-builder/api-client";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { chose: "Customer chose: {name}" },
  ar: { chose: "اختار العميل: {name}" },
} satisfies Messages;

type OptionSnapshot = { key: string; nameAr?: string | null; nameEn?: string | null };

/** The shipping option the customer picked at checkout (shipping/shippingOptions.js), when not the standard one. */
export function ShippingOptionNote({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const option = (order.shippingSnapshot as (Order["shippingSnapshot"] & { option?: OptionSnapshot }) | null | undefined)?.option;
  if (!option) return null;
  const name = (locale === "ar" ? option.nameAr || option.nameEn : option.nameEn || option.nameAr) || option.key;
  return <p className="text-end text-xs font-medium text-ink">{fmt(t.chose, { name })}</p>;
}
