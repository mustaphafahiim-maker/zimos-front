import { IconGift } from "@/components/icons";
import { isFreeGiftLine } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: { gift: "Gift", hint: "Free gift with the order — added by the store at no charge" },
  ar: { gift: "هدية", hint: "هدية مجانية مع الأوردر — المتجر ضافها ببلاش" },
} satisfies Messages;

/**
 * Order page, under an item: a line priced 0 is a free gift the checkout
 * added (Offers → Free gifts, handoff 208), so whoever packs puts it in.
 */
export function GiftLineBadge({ item }: { item: { unitPriceAmount: string | number; isOrderBump?: boolean; isUpsell?: boolean } }) {
  const t = useT(STRINGS);
  if (item.isOrderBump || item.isUpsell || !isFreeGiftLine(item)) return null;
  return (
    <span title={t.hint} className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-dark dark:text-primary">
      <IconGift className="size-3.5 shrink-0" aria-hidden />
      {t.gift}
      <span className="sr-only">: {t.hint}</span>
    </span>
  );
}
